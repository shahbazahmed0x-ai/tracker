import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, sessions, users, breaks } from "@/db/schema";
import { eq, and, gte, lte, desc, isNull } from "drizzle-orm";
import { getStartOfDayUTC, getEndOfDayUTC, getDateInTimezone } from "@/lib/utils";
import { getCurrentStatus } from "@/lib/calculation";

const TIMEZONE = process.env.TIMEZONE || "Asia/Kolkata";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const today = getDateInTimezone(TIMEZONE);
    const startOfDay = getStartOfDayUTC(today, TIMEZONE);
    const endOfDay = getEndOfDayUTC(today, TIMEZONE);

    // Get all active agents
    const agents = await db
      .select()
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.name);

    const teamStatus = await Promise.all(
      agents.map(async (agent) => {
        // Get today's events
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

        const currentStatus = getCurrentStatus(
          events.map((e) => ({ id: e.id, status: e.status, timestamp: e.timestamp }))
        );

        // Get today's sessions
        const todaySessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, agent.id),
              gte(sessions.loginTime, startOfDay),
              lte(sessions.loginTime, endOfDay)
            )
          )
          .orderBy(desc(sessions.loginTime))
          .limit(1);

        // Get open break
        const openBreak = await db
          .select()
          .from(breaks)
          .where(and(eq(breaks.userId, agent.id), isNull(breaks.breakEnd)))
          .orderBy(desc(breaks.breakStart))
          .limit(1);

        // Get completed sessions totals
        const allTodaySessions = await db
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, agent.id),
              gte(sessions.loginTime, startOfDay),
              lte(sessions.loginTime, endOfDay)
            )
          );

        let totalAvailable = 0;
        let totalBreak = 0;
        for (const s of allTodaySessions) {
          totalAvailable += s.availableSeconds || 0;
          totalBreak += s.breakSeconds || 0;
        }

        return {
          id: agent.id,
          name: agent.name,
          employeeId: agent.employeeId,
          role: agent.role,
          status: currentStatus.status,
          since: currentStatus.since,
          loginTime: todaySessions[0]?.loginTime || null,
          openBreakSince: openBreak[0]?.breakStart || null,
          totalAvailableSeconds: totalAvailable,
          totalBreakSeconds: totalBreak,
        };
      })
    );

    return NextResponse.json({ teamStatus, date: today });
  } catch (error) {
    console.error("Team status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
