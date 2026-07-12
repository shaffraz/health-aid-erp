import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoDoctors } from "@/lib/demo-data";
import { hasPermission, roleLabels } from "@/lib/permissions";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { withSupabaseTimeout } from "@/lib/supabase/config";
import type { AppUser, Role } from "@/lib/types";

export { hasPermission, roleLabels };

async function getDemoUser(): Promise<AppUser> {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("demo_role")?.value as Role | undefined;
  const role: Role = roleCookie && roleCookie in roleLabels ? roleCookie : "admin";
  const doctor = demoDoctors[0];

  return {
    id: `demo-${role}`,
    name:
      role === "doctor"
        ? doctor.name
        : role === "insurance_partner"
          ? "Global Travel Assist"
          : `Demo ${roleLabels[role]}`,
    email: `${role}@healthaid.local`,
    role,
    doctorId: role === "doctor" ? doctor.id : undefined,
    assistanceCompany: role === "insurance_partner" ? "Global Travel Assist" : undefined
  };
}

export async function getCurrentUser(): Promise<AppUser> {
  if (!isSupabaseConfigured()) {
    return getDemoUser();
  }

  const supabase = await createSupabaseServerClient();
  const userResult = await withSupabaseTimeout(
    supabase.auth.getUser(),
    "Supabase user session"
  ).catch((error) => {
    console.warn("Supabase auth unavailable; using demo/local user.", error);
    return null;
  });

  if (!userResult) {
    return getDemoUser();
  }

  const user = userResult.data.user;

  if (!user) {
    redirect("/login");
  }

  try {
    const { data: profile, error } = await withSupabaseTimeout(
      supabase
        .from("profiles")
        .select("id, full_name, role, doctor_id")
        .eq("id", user.id)
        .single(),
      "Supabase user profile"
    );

    if (error || !profile) {
      console.warn("Supabase profile unavailable; using demo/local user.", error);
      return getDemoUser();
    }

    return {
      id: profile.id,
      name: profile.full_name ?? user.email ?? "Health Aid user",
      email: user.email ?? "",
      role: profile.role,
      doctorId: profile.doctor_id ?? undefined
    };
  } catch (error) {
    console.warn("Supabase profile unavailable; using demo/local user.", error);
    return getDemoUser();
  }
}
