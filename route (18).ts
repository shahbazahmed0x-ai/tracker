import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, breaks } from "@/db/schema";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone, parseDate } from "@/lib/utils";
import { calculateSessionsFromEvents, aggregateDailyStats } from "@/lib/calculation";

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date") || "today";
    const parsedDate = parseDate(dateParam) || getDateInTimezone(TIMEZONE);

    const startOfDay = getStartOfDayUTC(parsedDate, TIMEZONE);
    const endOfDay = getEndOfDayUTC(parsedDate, TIMEZONE);

    // Get raw events
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
      .orderBy(statusEvents.timestamp);

    // Get sessions for breaks detail
    const userSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, session.userId),
          gte(sessions.loginTime, startOfDay),
          lte(sessions.loginTime, endOfDay)
        )
      )
      .orderBy(sessions.loginTime);

    // Get breaks
    const sessionIds = userSessions.map((s) => s.id);
    let breaksData: Array<{
      id: number;
      sessionId: number;
      userId: number;
      breakStart: Date;
      breakEnd: Date | null;
      durationSeconds: bigint | number | null;
      createdAt: Date;
      updatedAt: Date;
    }> = [];
    if (sessionIds.length > 0) {
      for (const sid of sessionIds) {
        const b = await db.select().from(breaks).where(eq(breaks.sessionId, sid));
        breaksData.push(...b);
      }
    }

    // Calculate from events
    const calculatedSessions = calculateSessionsFromEvents(
      events.map((e) => ({ id: e.id, status: e.status, timestamp: e.timestamp }))
    );

    const stats = aggregateDailyStats(calculatedSessions);

    return NextResponse.json({
      date: parsedDate,
      events: events.map((e) => ({
        id: e.id,
        status: e.status,
        timestamp: e.timestamp,
        source: e.source,
      })),
      sessions: userSessions.map((s) => ({
        id: s.id,
        loginTime: s.loginTime,
        logoutTime: s.logoutTime,
        availableSeconds: s.availableSeconds,
        breakSeconds: s.breakSeconds,
        isComplete: s.isComplete,
      })),
      breaks: breaksData.map((b) => ({
        id: b.id,
        sessionId: b.sessionId,
        breakStart: b.breakStart,
        breakEnd: b.breakEnd,
        durationSeconds: b.durationSeconds ? Number(b.durationSeconds) : null,
      })),
      stats,
    });
  } catch (error) {
    console.error("My report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
