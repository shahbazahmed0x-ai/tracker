import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone, parseDate, formatDurationShort, formatTime } from "@/lib/utils";
import { calculateSessionsFromEvents, aggregateDailyStats } from "@/lib/calculation";

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date") || "today";
    const parsedDate = parseDate(dateParam) || getDateInTimezone(TIMEZONE);

    const startOfDay = getStartOfDayUTC(parsedDate, TIMEZONE);
    const endOfDay = getEndOfDayUTC(parsedDate, TIMEZONE);

    const agents = await db
      .select()
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.name);

    const rows: string[] = [
      "Date,Employee ID,Agent Name,Login Time,Logout Time,Available Time,Break Time,Session Time,Break Count,Session Count",
    ];

    for (const agent of agents) {
      const events = await db
        .select()
        .from(statusEvents)
        .where(
          and(
            eq(statusEvents.userId, agent.id),
            gte(statusEvents.timestamp, startOfDay),
            lte(statusEvents.timestamp, endOfDay)
          )
        )
        .orderBy(statusEvents.timestamp);

      if (events.length === 0) continue;

      const calculatedSessions = calculateSessionsFromEvents(
        events.map((e) => ({ id: e.id, status: e.status, timestamp: e.timestamp }))
      );

      const stats = aggregateDailyStats(calculatedSessions);
      const firstLogin = events.find((e) => e.status === "logged_in");
      const lastLogout = [...events].reverse().find((e) => e.status === "logged_out");

      rows.push(
        [
          parsedDate,
          agent.employeeId,
          `"${agent.name}"`,
          firstLogin ? formatTime(firstLogin.timestamp, TIMEZONE) : "",
          lastLogout ? formatTime(lastLogout.timestamp, TIMEZONE) : "",
          formatDurationShort(stats.availableSeconds),
          formatDurationShort(stats.breakSeconds),
          formatDurationShort(stats.sessionSeconds),
          stats.breakCount,
          stats.sessionCount,
        ].join(",")
      );
    }

    const csv = rows.join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="availability-${parsedDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
