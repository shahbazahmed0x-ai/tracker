import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, users } from "@/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone, parseDate } from "@/lib/utils";
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

    const agentReports = await Promise.all(
      agents.map(async (agent) => {
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

        const userSessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, agent.id),
              gte(sessions.loginTime, startOfDay),
              lte(sessions.loginTime, endOfDay)
            )
          )
          .orderBy(sessions.loginTime);

        const calculatedSessions = calculateSessionsFromEvents(
          events.map((e) => ({ id: e.id, status: e.status, timestamp: e.timestamp }))
        );

        const stats = aggregateDailyStats(calculatedSessions);

        const firstLogin = events.find((e) => e.status === "logged_in");
        const lastLogout = [...events].reverse().find((e) => e.status === "logged_out");

        return {
          id: agent.id,
          name: agent.name,
          employeeId: agent.employeeId,
          role: agent.role,
          stats,
          loginTime: firstLogin?.timestamp || null,
          logoutTime: lastLogout?.timestamp || null,
          hasActivity: events.length > 0,
        };
      })
    );

    const totalAvailable = agentReports.reduce((sum, a) => sum + a.stats.availableSeconds, 0);
    const totalBreak = agentReports.reduce((sum, a) => sum + a.stats.breakSeconds, 0);
    const totalSession = agentReports.reduce((sum, a) => sum + a.stats.sessionSeconds, 0);
    const activeAgents = agentReports.filter((a) => a.hasActivity).length;
    const completedAgents = agentReports.filter(
      (a) => !a.stats.isIncomplete && a.hasActivity
    ).length;

    return NextResponse.json({
      date: parsedDate,
      agents: agentReports,
      summary: {
        totalAgents: agents.length,
        activeAgents,
        completedAgents,
        totalAvailableSeconds: totalAvailable,
        totalBreakSeconds: totalBreak,
        totalSessionSeconds: totalSession,
      },
    });
  } catch (error) {
    console.error("Team report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
