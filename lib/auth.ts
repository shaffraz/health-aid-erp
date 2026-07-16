import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoDoctors, demoUsers } from "@/lib/demo-data";
import { hasPermission, roleLabels } from "@/lib/permissions";
import { isSupabaseConfigured, createSupabaseServerClient } from "@/lib/supabase/server";
import { withSupabaseTimeout } from "@/lib/supabase/config";
import type { AppUser, Role } from "@/lib/types";

export { hasPermission, roleLabels };

export function normalizeRole(value?: string): Role {
  if (value === "admin") {
    return "administrator";
  }

  if (value === "accountant") {
    return "director";
  }

  if (value === "insurance_partner") {
    return "assistance_company";
  }

  return value && value in roleLabels ? (value as Role) : "administrator";
}

async function getDemoUser(): Promise<AppUser> {
  const cookieStore = await cookies();
  const role = normalizeRole(cookieStore.get("demo_role")?.value);
  const doctor = demoDoctors[0];
  const managedUser = demoUsers.find((user) => user.role === role);

  return {
    id: managedUser?.id ?? `demo-${role}`,
    name:
      role === "doctor"
        ? doctor.name
        : role === "assistance_company"
          ? "Global Travel Assist"
          : managedUser?.name ?? `Demo ${roleLabels[role]}`,
    email: managedUser?.email ?? `${role}@healthaid.local`,
    role,
    administratorPrivileges: managedUser?.administratorPrivileges,
    doctorId: role === "doctor" ? doctor.id : undefined,
    assistanceCompanyId:
      role === "assistance_company" ? managedUser?.assistanceCompanyId : undefined,
    assistanceCompany: role === "assistance_company" ? managedUser?.assistanceCompany : undefined
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
        .select("id, full_name, role, administrator_privileges, doctor_id, assistance_company_id")
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
      role: normalizeRole(profile.role),
      administratorPrivileges: Boolean(profile.administrator_privileges),
      doctorId: profile.doctor_id ?? undefined,
      assistanceCompanyId: profile.assistance_company_id ?? undefined
    };
  } catch (error) {
    console.warn("Supabase profile unavailable; using demo/local user.", error);
    return getDemoUser();
  }
}
