"use client";

import { useEffect, useMemo, useState } from "react";
import { KpiCard } from "@/components/erp-ui";
import { shortDate } from "@/lib/format";
import { roleLabels } from "@/lib/permissions";
import { staffStorageKey, type AppUser, type AssistanceCompany, type Doctor, type StaffMember } from "@/lib/types";

type MyProfileDashboardProps = {
  user: AppUser;
  doctors: Doctor[];
  assistanceCompanies: AssistanceCompany[];
  staffMembers: StaffMember[];
};

function statusLabel(status: StaffMember["status"]) {
  return status === "active" ? "Active" : "Inactive";
}

export function MyProfileDashboard({
  assistanceCompanies,
  doctors,
  staffMembers,
  user
}: MyProfileDashboardProps) {
  const [localStaffMembers, setLocalStaffMembers] = useState(staffMembers);
  const linkedDoctor = doctors.find((doctor) => doctor.id === user.doctorId);
  const linkedCompany = assistanceCompanies.find(
    (company) => company.id === user.assistanceCompanyId
  );

  useEffect(() => {
    try {
      const storedStaff = window.localStorage.getItem(staffStorageKey);

      if (storedStaff) {
        const parsed = JSON.parse(storedStaff);

        if (Array.isArray(parsed)) {
          setLocalStaffMembers(parsed as StaffMember[]);
        }
      }
    } catch {
      setLocalStaffMembers(staffMembers);
    }
  }, [staffMembers]);

  const linkedStaff = useMemo(
    () => localStaffMembers.find((staff) => staff.userId === user.id),
    [localStaffMembers, user.id]
  );

  if (user.role === "staff") {
    if (!linkedStaff) {
      return (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold text-[#224770]">Profile Link Required</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#46484a]">
            Your login account is not linked to a staff profile yet. Please request a profile
            correction from the administrator.
          </p>
        </section>
      );
    }

    return (
      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] p-5">
          <h2 className="text-lg font-semibold text-white">Staff Profile</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <ProfileField label="Full Name" value={linkedStaff.fullName} />
          <ProfileField label="Designation" value={linkedStaff.designation} />
          <ProfileField label="Mobile Number" value={linkedStaff.mobileNumber} />
          <ProfileField label="Email" value={linkedStaff.email ?? "-"} />
          <ProfileField label="Join Date" value={shortDate(linkedStaff.joinDate)} />
          <ProfileField label="Employment Status" value={statusLabel(linkedStaff.status)} />
        </div>
        <div className="border-t border-[#efefef] p-5">
          <p className="text-sm font-medium text-[#46484a]">
            Profile changes are managed by administration. Please request a correction if any
            information is inaccurate.
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <KpiCard label="Name" value={user.name} tone="primary" />
      <KpiCard label="Role" value={roleLabels[user.role]} />
      <KpiCard label="Email" value={user.email} />
      {linkedDoctor ? (
        <>
          <KpiCard label="Linked Doctor" value={linkedDoctor.name} tone="success" />
          <KpiCard label="Designation" value={linkedDoctor.designation} />
          <KpiCard label="Phone" value={linkedDoctor.phone ?? "-"} />
        </>
      ) : null}
      {linkedCompany ? (
        <>
          <KpiCard label="Linked Assistance Company" value={linkedCompany.name} tone="success" />
          <KpiCard label="Contact Person" value={linkedCompany.contactPerson ?? "-"} />
          <KpiCard label="Company Phone" value={linkedCompany.phone ?? "-"} />
        </>
      ) : null}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-white p-4 shadow-sm">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}
