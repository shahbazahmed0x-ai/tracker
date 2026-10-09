import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamDashboard } from "./TeamDashboard";

export default async function TeamPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "team_leader") redirect("/dashboard");

  return <TeamDashboard />;
}
