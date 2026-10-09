import {
  pgTable,
  serial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["agent", "team_leader", "admin"]);
export const statusEnum = pgEnum("status", [
  "logged_in",
  "break",
  "back",
  "logged_out",
]);
export const sourceEnum = pgEnum("source", ["button", "message", "admin", "system"]);

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  employeeId: varchar("employee_id", { length: 50 }).unique().notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").notNull().default("agent"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Status events - raw log of every status change
export const statusEvents = pgTable("status_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: statusEnum("status").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  source: sourceEnum("source").notNull().default("button"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sessions - one per login/logout pair
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  loginTime: timestamp("login_time", { withTimezone: true }).notNull(),
  logoutTime: timestamp("logout_time", { withTimezone: true }),
  availableSeconds: bigint("available_seconds", { mode: "number" }).notNull().default(0),
  breakSeconds: bigint("break_seconds", { mode: "number" }).notNull().default(0),
  isComplete: boolean("is_complete").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Breaks - each break within a session
export const breaks = pgTable("breaks", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  breakStart: timestamp("break_start", { withTimezone: true }).notNull(),
  breakEnd: timestamp("break_end", { withTimezone: true }),
  durationSeconds: bigint("duration_seconds", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Audit logs - for admin corrections
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Auth sessions (JWT refresh tokens / web sessions)
export const authSessions = pgTable("auth_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 512 }).notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  statusEvents: many(statusEvents),
  sessions: many(sessions),
  breaks: many(breaks),
  auditLogsAsAdmin: many(auditLogs, { relationName: "adminAuditLogs" }),
  auditLogsAsTarget: many(auditLogs, { relationName: "targetAuditLogs" }),
  authSessions: many(authSessions),
}));

export const statusEventsRelations = relations(statusEvents, ({ one }) => ({
  user: one(users, {
    fields: [statusEvents.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
  breaks: many(breaks),
}));

export const breaksRelations = relations(breaks, ({ one }) => ({
  session: one(sessions, {
    fields: [breaks.sessionId],
    references: [sessions.id],
  }),
  user: one(users, {
    fields: [breaks.userId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [auditLogs.adminId],
    references: [users.id],
    relationName: "adminAuditLogs",
  }),
  targetUser: one(users, {
    fields: [auditLogs.targetUserId],
    references: [users.id],
    relationName: "targetAuditLogs",
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));
