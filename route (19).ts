import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { statusEvents, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { eventId, reason } = body;

    if (!eventId || !reason) {
      return NextResponse.json({ error: "Event ID and reason are required" }, { status: 400 });
    }

    // Get old value
    const oldEvent = await db
      .select()
      .from(statusEvents)
      .where(eq(statusEvents.id, eventId))
      .limit(1);

    if (!oldEvent[0]) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await db.delete(statusEvents).where(eq(statusEvents.id, eventId));

    // Audit log
    await db.insert(auditLogs).values({
      adminId: session.userId,
      action: "delete_status_event",
      targetUserId: oldEvent[0].userId,
      oldValue: JSON.stringify({
        id: oldEvent[0].id,
        status: oldEvent[0].status,
        timestamp: oldEvent[0].timestamp,
      }),
      reason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Edit status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { eventId, newTimestamp, reason } = body;

    if (!eventId || !newTimestamp || !reason) {
      return NextResponse.json({ error: "Event ID, new timestamp, and reason are required" }, { status: 400 });
    }

    const oldEvent = await db
      .select()
      .from(statusEvents)
      .where(eq(statusEvents.id, eventId))
      .limit(1);

    if (!oldEvent[0]) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(statusEvents)
      .set({ timestamp: new Date(newTimestamp) })
      .where(eq(statusEvents.id, eventId))
      .returning();

    await db.insert(auditLogs).values({
      adminId: session.userId,
      action: "edit_status_event",
      targetUserId: oldEvent[0].userId,
      oldValue: JSON.stringify({
        id: oldEvent[0].id,
        status: oldEvent[0].status,
        timestamp: oldEvent[0].timestamp,
      }),
      newValue: JSON.stringify({ timestamp: newTimestamp }),
      reason,
    });

    return NextResponse.json({ success: true, event: updated });
  } catch (error) {
    console.error("Edit status PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
