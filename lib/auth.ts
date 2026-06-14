import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoDoctors } from "@/lib/demo-data";
import { hasPermission, roleLabels } from "@/lib/permissions";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import type { AppUser, Role } from "@/lib/types";

export { hasPermission, roleLabels };

export async function getCurrentUser(): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    const roleCookie = cookieStore.get("demo_role")?.value as Role | undefined;
    const role: Role = roleCookie && roleCookie in roleLabels ? roleCookie : "admin";
    const doctor = demoDoctors[0];

    return {
      id: `demo-${role}`,
      name: role === "doctor" ? doctor.name : `Demo ${roleLabels[role]}`,
      email: `${role}@healthaid.local`,
      role,
      doctorId: role === "doctor" ? doctor.id : undefined
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, doctor_id")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    redirect("/login");
  }

  return {
    id: profile.id,
    name: profile.full_name ?? user.email ?? "Health Aid user",
    email: user.email ?? "",
    role: profile.role,
    doctorId: profile.doctor_id ?? undefined
  };
}
