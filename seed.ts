/**
 * Seed the database with initial admin user and sample agents.
 * Run once during setup.
 */
import { db } from "@/db";
import { users } from "@/db/schema";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  // Check if admin already exists
  const existing = await db.select().from(users).where(eq(users.email, "admin@company.com")).limit(1);
  if (existing.length > 0) {
    return { message: "Database already seeded" };
  }

  const passwordHash = await bcrypt.hash("Admin@123", 12);
  const agentHash = await bcrypt.hash("Agent@123", 12);

  // Create admin
  await db.insert(users).values({
    employeeId: "EMP000",
    name: "System Admin",
    email: "admin@company.com",
    passwordHash,
    role: "admin",
    active: true,
  });

  // Create team leader
  await db.insert(users).values({
    employeeId: "EMP001",
    name: "Team Leader",
    email: "leader@company.com",
    passwordHash,
    role: "team_leader",
    active: true,
  });

  // Create sample agents
  const agents = [
    { employeeId: "EMP002", name: "Rahul Sharma", email: "rahul@company.com" },
    { employeeId: "EMP003", name: "Ayaan Khan", email: "ayaan@company.com" },
    { employeeId: "EMP004", name: "Manav Patel", email: "manav@company.com" },
    { employeeId: "EMP005", name: "Rajat Singh", email: "rajat@company.com" },
    { employeeId: "EMP006", name: "Priya Mehta", email: "priya@company.com" },
  ];

  for (const agent of agents) {
    await db.insert(users).values({
      ...agent,
      passwordHash: agentHash,
      role: "agent",
      active: true,
    });
  }

  return { message: "Database seeded successfully" };
}
