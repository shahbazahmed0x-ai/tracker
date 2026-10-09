import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

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

    const user = await db
      .select({
        id: users.id,
        employeeId: users.employeeId,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user[0]) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    return NextResponse.json({ agent: user[0] });
  } catch (error) {
    console.error("Agent GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
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

    const body = await request.json();
    const { name, email, role, active } = body;

    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase().trim();
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        employeeId: users.employeeId,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      });

    if (!updated) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // Audit log
    await db.insert(auditLogs).values({
      adminId: session.userId,
      action: "update_agent",
      targetUserId: userId,
      newValue: JSON.stringify({ name, email, role, active }),
      reason: body.reason || "Admin update",
    });

    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error("Agent PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
