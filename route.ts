import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, breaks, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone, parseDate } from "@/lib/utils";
import { calculateSessionsFromEvents, aggregateDailyStats } from "@/lib/calculation";

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const userId = parseInt(id);
    if (isNaN(userId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date") || "today";
    const parsedDate = parseDate(dateParam) || getDateInTimezone(TIMEZONE);

    const startOfDay = getStartOfDayUTC(parsedDate, TIMEZONE);
    const endOfDay = getEndOfDayUTC(parsedDate, TIMEZONE);

    const agent = await db
      .select({ id: users.id, name: users.name, employeeId: users.employeeId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!agent[0]) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const events = await db
      .select()
      .from(statusEvents)
      .where(
        and(
          eq(statusEvents.userId, userId),
          gte(statusEvents.timestamp, startOfDay),
          lte(statusEvents.timestamp, endOfDay)
        )
      )
      .orderBy(statusEvents.timestamp);

    const userSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, userId),
          gte(sessions.loginTime, startOfDay),
          lte(sessions.loginTime, endOfDay)
        )
      )
      .orderBy(sessions.loginTime);

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
    for (const sid of sessionIds) {
      const b = await db.select().from(breaks).where(eq(breaks.sessionId, sid));
      breaksData.push(...b);
    }

    const calculatedSessions = calculateSessionsFromEvents(
      events.map((e) => ({ id: e.id, status: e.status, timestamp: e.timestamp }))
    );

    const stats = aggregateDailyStats(calculatedSessions);

    return NextResponse.json({
      agent: agent[0],
      date: parsedDate,
      events: events.map((e) => ({
        id: e.id,
        status: e.status,
        timestamp: e.timestamp,
        source: e.source,
      })),
      stats,
      breaks: breaksData.map((b) => ({
        id: b.id,
        sessionId: b.sessionId,
        breakStart: b.breakStart,
        breakEnd: b.breakEnd,
        durationSeconds: b.durationSeconds ? Number(b.durationSeconds) : null,
      })),
    });
  } catch (error) {
    console.error("Agent report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
