import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReportsPage } from "./ReportsPage";

export default async function Reports() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin" && session.role !== "team_leader") redirect("/dashboard");

  return <ReportsPage />;
}
