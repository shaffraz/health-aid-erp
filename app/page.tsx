import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { landingPathForRole } from "@/lib/permissions";

export default async function HomePage() {
  const user = await getCurrentUser();

  redirect(landingPathForRole(user.role));
}
