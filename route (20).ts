import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, breaks, users } from "@/db/schema";
import { eq, and, desc, gte, lte, isNull } from "drizzle-orm";
import { getCurrentStatus } from "@/lib/calculation";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone } from "@/lib/utils";

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = getDateInTimezone(TIMEZONE);
    const startOfDay = getStartOfDayUTC(today, TIMEZONE);
    const endOfDay = getEndOfDayUTC(today, TIMEZONE);

    const events = await db
      .select()
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.userId, session.userId),
          gte(statusEvents.timestamp, startOfDay),
          lte(statusEvents.timestamp, endOfDay)
        )
      )
      .orderBy(desc(statusEvents.timestamp))
      .limit(1);

    const allTodayEvents = await db
      .select()
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.userId, session.userId),
          gte(statusEvents.timestamp, startOfDay),
          lte(statusEvents.timestamp, endOfDay)
        )
      )
      .orderBy(statusEvents.timestamp);

    const currentStatus = getCurrentStatus(allTodayEvents.map((e) => ({
      id: e.id,
      status: e.status,
      timestamp: e.timestamp,
    })));

    return NextResponse.json({
      status: currentStatus.status,
      since: currentStatus.since,
      lastEvent: events[0] || null,
    });
  } catch (error) {
    console.error("Status GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action } = body; // "logged_in" | "break" | "back" | "logged_out"

    if (!["logged_in", "break", "back", "logged_out"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const now = new Date();
    const today = getDateInTimezone(TIMEZONE);
    const startOfDay = getStartOfDayUTC(today, TIMEZONE);
    const endOfDay = getEndOfDayUTC(today, TIMEZONE);

    // Get today's events
    const todayEvents = await db
      .select()
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.userId, session.userId),
          gte(statusEvents.timestamp, startOfDay),
          lte(statusEvents.timestamp, endOfDay)
        )
      )
      .orderBy(statusEvents.timestamp);

    const currentStatus = getCurrentStatus(todayEvents.map((e) => ({
      id: e.id,
      status: e.status,
      timestamp: e.timestamp,
    })));

    // State machine validation
    const validationError = validateTransition(currentStatus.status, action);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }

    // Record the event
    const [newEvent] = await db
      .insert(statusEvents)
      .values({
        userId: session.userId,
        status: action as "logged_in" | "break" | "back" | "logged_out",
        timestamp: now,
        source: "button",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
      })
      .returning();

    // Update sessions table
    if (action === "logged_in") {
      await db.insert(sessions).values({
        userId: session.userId,
        loginTime: now,
        isComplete: false,
        availableSeconds: 0,
        breakSeconds: 0,
      });
    } else if (action === "break") {
      // Find current open session
      const openSession = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, session.userId), eq(sessions.isComplete, false)))
        .orderBy(desc(sessions.loginTime))
        .limit(1);

      if (openSession[0]) {
        // Update available seconds up to now
        await recalcSessionAvailable(openSession[0].id, now);
        // Start a break record
        await db.insert(breaks).values({
          sessionId: openSession[0].id,
          userId: session.userId,
          breakStart: now,
        });
      }
    } else if (action === "back") {
      // Close the open break
      const openBreak = await db
        .select()
        .from(breaks)
        .where(and(eq(breaks.userId, session.userId), isNull(breaks.breakEnd)))
        .orderBy(desc(breaks.breakStart))
        .limit(1);

      if (openBreak[0]) {
        const durationSeconds = Math.floor(
          (now.getTime() - openBreak[0].breakStart.getTime()) / 1000
        );
        await db
          .update(breaks)
          .set({
            breakEnd: now,
            durationSeconds,
            updatedAt: now,
          })
          .where(eq(breaks.id, openBreak[0].id));

        // Update session break seconds
        const openSession = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, openBreak[0].sessionId))
          .limit(1);

        if (openSession[0]) {
          await db
            .update(sessions)
            .set({
              breakSeconds: (openSession[0].breakSeconds || 0) + durationSeconds,
              updatedAt: now,
            })
            .where(eq(sessions.id, openSession[0].id));
        }
      }
    } else if (action === "logged_out") {
      // Close any open break first
      const openBreak = await db
        .select()
        .from(breaks)
        .where(and(eq(breaks.userId, session.userId), isNull(breaks.breakEnd)))
        .orderBy(desc(breaks.breakStart))
        .limit(1);

      let sessionToClose: typeof sessions.$inferSelect | null = null;

      if (openBreak[0]) {
        const durationSeconds = Math.floor(
          (now.getTime() - openBreak[0].breakStart.getTime()) / 1000
        );
        await db
          .update(breaks)
          .set({ breakEnd: now, durationSeconds, updatedAt: now })
          .where(eq(breaks.id, openBreak[0].id));

        // Get session
        const s = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, openBreak[0].sessionId))
          .limit(1);

        if (s[0]) {
          sessionToClose = s[0];
          await db
            .update(sessions)
            .set({
              breakSeconds: (s[0].breakSeconds || 0) + durationSeconds,
              updatedAt: now,
            })
            .where(eq(sessions.id, s[0].id));
        }
      }

      // Find the open session (if not found via break)
      if (!sessionToClose) {
        const s = await db
          .select()
          .from(sessions)
          .where(and(eq(sessions.userId, session.userId), eq(sessions.isComplete, false)))
          .orderBy(desc(sessions.loginTime))
          .limit(1);
        sessionToClose = s[0] || null;
      }

      if (sessionToClose) {
        // Recalculate available seconds
        await recalcSessionAvailable(sessionToClose.id, now);

        // Re-fetch to get updated values
        const updatedSession = await db
          .select()
          .from(sessions)
          .where(eq(sessions.id, sessionToClose.id))
          .limit(1);

        if (updatedSession[0]) {
          const totalSession = Math.floor(
            (now.getTime() - updatedSession[0].loginTime.getTime()) / 1000
          );
          const available = totalSession - (updatedSession[0].breakSeconds || 0);
          await db
            .update(sessions)
            .set({
              logoutTime: now,
              isComplete: true,
              availableSeconds: Math.max(0, available),
              updatedAt: now,
            })
            .where(eq(sessions.id, sessionToClose.id));
        }
      }
    }

    return NextResponse.json({ success: true, event: newEvent, timestamp: now });
  } catch (error) {
    console.error("Status POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function validateTransition(
  current: "logged_in" | "break" | "logged_out" | "not_logged_in",
  action: string
): string | null {
  switch (action) {
    case "logged_in":
      if (current === "logged_in" || current === "break") {
        return "You are already logged in.";
      }
      return null;
    case "break":
      if (current === "not_logged_in" || current === "logged_out") {
        return "Please click 🟢 Logged In first.";
      }
      if (current === "break") {
        return "You are already on Break.";
      }
      return null;
    case "back":
      if (current === "not_logged_in" || current === "logged_out") {
        return "You are not currently logged in.";
      }
      if (current === "logged_in") {
        return "You are not currently on Break.";
      }
      return null;
    case "logged_out":
      if (current === "not_logged_in" || current === "logged_out") {
        return "You are not currently logged in.";
      }
      return null;
    default:
      return "Invalid action.";
  }
}

async function recalcSessionAvailable(sessionId: number, upTo: Date) {
  // Get session and all its breaks to compute available seconds from scratch
  const sessionData = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!sessionData[0]) return;

  const allBreaks = await db
    .select()
    .from(breaks)
    .where(eq(breaks.sessionId, sessionId))
    .orderBy(breaks.breakStart);

  let totalBreakSeconds = 0;
  for (const b of allBreaks) {
    if (b.durationSeconds) {
      totalBreakSeconds += b.durationSeconds;
    } else if (b.breakEnd) {
      totalBreakSeconds += Math.floor(
        (b.breakEnd.getTime() - b.breakStart.getTime()) / 1000
      );
    }
  }

  const sessionSeconds = Math.floor(
    (upTo.getTime() - sessionData[0].loginTime.getTime()) / 1000
  );
  const availableSeconds = Math.max(0, sessionSeconds - totalBreakSeconds);

  await db
    .update(sessions)
    .set({ availableSeconds, breakSeconds: totalBreakSeconds, updatedAt: upTo })
    .where(eq(sessions.id, sessionId));
}
