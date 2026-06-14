import { LockKeyhole } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="panel flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-rose-50 p-3 text-rose-600">
        <LockKeyhole className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-ink">Access restricted</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        Your current role does not have permission to use this module. Health Aid keeps
        payment rules, payout controls, reports, and doctor earnings scoped by role.
      </p>
    </div>
  );
}
