import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users, authSessions } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";
const secret = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
  userId: number;
  email: string;
  role: "agent" | "team_leader" | "admin";
  name: string;
  employeeId: string;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<JWTPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function requireAdmin(): Promise<JWTPayload> {
  const session = await requireSession();
  if (session.role !== "admin" && session.role !== "team_leader") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getUserFromSession() {
  const session = await getSession();
  if (!session) return null;

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.userId), eq(users.active, true)))
    .limit(1);

  return user[0] || null;
}

export function isAdmin(role: string): boolean {
  return role === "admin" || role === "team_leader";
}
