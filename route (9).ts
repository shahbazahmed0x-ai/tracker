import { NextRequest, NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const agents = await db
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
      .orderBy(users.name);

    return NextResponse.json({ agents });
  } catch (error) {
    console.error("Agents GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdmin(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { employeeId, name, email, password, role } = body;

    if (!employeeId || !name || !email || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [newUser] = await db
      .insert(users)
      .values({
        employeeId,
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: role || "agent",
        active: true,
      })
      .returning({
        id: users.id,
        employeeId: users.employeeId,
        name: users.name,
        email: users.email,
        role: users.role,
        active: users.active,
      });

    return NextResponse.json({ agent: newUser }, { status: 201 });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message.includes("unique")
    ) {
      return NextResponse.json(
        { error: "Employee ID or email already exists" },
        { status: 409 }
      );
    }
    console.error("Agents POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
