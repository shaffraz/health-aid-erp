# Health Aid Arugambay ERP POS

Secure, mobile-responsive MVP for Health Aid Arugambay built with Next.js, TypeScript, Tailwind CSS, Supabase, and PostgreSQL.

## MVP Scope

- Role-based access for Admin, Staff, Doctor, and Accountant.
- Invoice POS with invoice-scoped patient details only.
- Service catalog across healthcare billing categories.
- Doctor setup with doctor-specific payout rules.
- Automatic doctor payout generation from invoice items.
- Doctor portal scoped to the logged-in doctor's own earnings.
- Admin/accountant payout voucher management and PDF export.
- Reports for sales, categories, invoices, payouts, and monthly doctor payments.
- Audit logs for invoice creation, voucher status changes, and payout edits.

Patient management is intentionally not included yet. Patient name, passport, phone, and nationality are stored only on invoices.

## Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If Supabase environment variables are not set, the app runs in demo mode with a role switcher so the MVP can be reviewed immediately.

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
   - `admin`
   - `staff`
   - `doctor`
   - `accountant`
6. For doctor users, set `profiles.doctor_id` to the matching `doctors.id`.

## Security Model

The UI uses role-aware navigation, and PostgreSQL Row Level Security enforces access at the database layer:

- Doctors can select only their own doctor payout rows.
- Staff can create invoices but cannot change doctors, services, or payment rules.
- Admin can manage all setup and operational data.
- Accountant can view reports and manage payout vouchers.
- Payment rule access is restricted from staff and doctors.

The invoice item trigger creates unpaid doctor payout records automatically using the selected invoice doctor and rule priority:

1. Doctor-specific service rule.
2. Doctor-specific category rule.
3. Service default payout configuration.

## Notes

The current UI includes demo-mode local state for immediate review. With Supabase connected, server actions persist core workflows for invoices, services, doctors, doctor payment rules, payout voucher generation, and voucher payment status updates.
