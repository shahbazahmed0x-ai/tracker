import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgentsPage } from "./AgentsPage";

export default async function Agents() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "team_leader") redirect("/dashboard");

  return <AgentsPage />;
}
