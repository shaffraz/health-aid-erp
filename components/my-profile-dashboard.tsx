"use client";

import { KpiCard } from "@/components/erp-ui";
import { roleLabels } from "@/lib/permissions";
import type { AppUser, AssistanceCompany, Doctor } from "@/lib/types";

type MyProfileDashboardProps = {
  user: AppUser;
  doctors: Doctor[];
  assistanceCompanies: AssistanceCompany[];
};

export function MyProfileDashboard({
  assistanceCompanies,
  doctors,
  user
}: MyProfileDashboardProps) {
  const linkedDoctor = doctors.find((doctor) => doctor.id === user.doctorId);
  const linkedCompany = assistanceCompanies.find(
    (company) => company.id === user.assistanceCompanyId
  );

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
