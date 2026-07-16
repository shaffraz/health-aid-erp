# Health Aid Arugambay ERP

Secure, mobile-responsive MVP for Health Aid Arugambay built with Next.js, TypeScript, Tailwind CSS, Supabase, and PostgreSQL.

## MVP Scope

- Role-based access for Administrator, Director, Staff, Doctor, and Assistance Company users.
- Invoice POS with invoice-scoped patient details only.
- Service catalog across healthcare billing categories.
- Doctor setup with doctor-specific payout rules.
- Automatic doctor payout generation from invoice items.
- Doctor portal scoped to the logged-in doctor's own earnings.
- Administrator payout voucher management and PDF export.
- Reports for recognized revenue, income by category, and invoice activity.
- Audit logs for invoice creation, voucher status changes, and payout edits.

Patient management is intentionally not included yet. Patient name, passport, phone, and nationality are stored only on invoices.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If Supabase environment variables are not set, the app runs in demo mode with a role switcher so the MVP can be reviewed immediately.

Development and production builds use separate Next.js output directories. `npm run dev` uses the normal `.next` folder, while `npm run build` writes to `.next-build` so production builds do not overwrite CSS and JavaScript assets used by a running dev session.

## Supabase Setup

1. Create a Supabase project.
2. Run the SQL migration in `supabase/migrations/202606150001_health_aid_mvp.sql`.
3. Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Create Supabase Auth users.
5. Insert matching rows in `profiles`, assigning each user one of:
   - `administrator`
   - `director`
   - `staff`
   - `doctor`
   - `assistance_company`
6. For doctor users, set `profiles.doctor_id` to the matching `doctors.id`.
7. For assistance company users, link the user profile to exactly one assistance company before enabling partner access.

## Security Model

The UI uses role-aware navigation, and PostgreSQL Row Level Security enforces access at the database layer:

- Administrators can manage setup, users, services, doctors, insurance configuration, payout vouchers, and payment settings.
- Directors can view business oversight pages but cannot change global setup or delete operational records.
- Staff can create invoices, view invoice registry data, manage daily insurance statement workflows, and review doctors/services.
- Doctors can view only their own portal, consultations, payout records, and payment history.
- Assistance Company users can view only their own statements, claim history, payments, and outstanding claims.
- Server actions also check role permissions before performing protected Supabase writes. PostgreSQL Row Level Security must still enforce the same rules at table level before real patient or financial data is used.

The invoice item trigger creates unpaid doctor payout records automatically using the selected invoice doctor and rule priority:

1. Doctor-specific service rule.
2. Doctor-specific category rule.
3. Service default payout configuration.

## Notes

The current UI includes demo-mode local state for immediate review. With Supabase connected, server actions persist core workflows for invoices, services, doctors, doctor payment rules, payout voucher generation, and voucher payment status updates.

User passwords shown in demo/local User Management are mock-only placeholders. Production users must be created through Supabase Auth or another secure identity provider; plaintext passwords must never be stored in application tables.
