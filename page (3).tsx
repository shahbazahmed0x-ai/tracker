import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AgentDashboard } from "./AgentDashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <AgentDashboard
      user={{
        id: session.userId,
        name: session.name,
        role: session.role,
        employeeId: session.employeeId,
      }}
    />
  );
}
