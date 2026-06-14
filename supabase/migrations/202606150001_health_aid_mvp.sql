create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'staff', 'doctor', 'accountant');
create type public.service_category as enum (
  'Consultation',
  'Consumables',
  'Hospital charges',
  'Lab services',
  'Procedures',
  'Day care admissions',
  'Injections',
  'IV therapy',
  'Wound care',
  'ARV / vaccines',
  'Other'
);
create type public.payment_method as enum ('cash', 'card', 'bank_transfer', 'insurance', 'other');
create type public.payout_rule_type as enum ('fixed', 'percentage', 'none');
create type public.payout_status as enum ('unpaid', 'paid');
create type public.voucher_status as enum ('unpaid', 'paid');

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty text,
  registration_no text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'staff',
  doctor_id uuid references public.doctors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_profiles_have_doctor check (
    role <> 'doctor' or doctor_id is not null
  )
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category public.service_category not null,
  selling_price numeric(12,2) not null check (selling_price >= 0),
  default_payout_type public.payout_rule_type not null default 'none',
  default_payout_value numeric(12,2) not null default 0 check (default_payout_value >= 0),
  default_payout_reason text not null default 'No doctor payout configured',
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_payment_rules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  service_id uuid references public.services(id) on delete cascade,
  category public.service_category,
  rule_type public.payout_rule_type not null,
  rule_value numeric(12,2) not null default 0 check (rule_value >= 0),
  reason text not null,
  priority integer not null default 50,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_rule_scope check (
    (service_id is not null and category is null) or
    (service_id is null and category is not null)
  )
);

create sequence public.invoice_no_seq start 1;

create or replace function public.next_invoice_no()
returns text
language sql
as $$
  select 'HA-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.invoice_no_seq')::text, 4, '0')
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text not null unique default public.next_invoice_no(),
  invoice_date date not null default current_date,
  patient_name text not null,
  passport text,
  phone text,
  nationality text,
  doctor_id uuid not null references public.doctors(id),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  payment_method public.payment_method not null default 'cash',
  notes text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  service_id uuid not null references public.services(id),
  service_name text not null,
  category public.service_category not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (quantity * unit_price) stored,
  created_at timestamptz not null default now()
);

create sequence public.payout_voucher_no_seq start 1;

create or replace function public.next_payout_voucher_no()
returns text
language sql
as $$
  select 'DPV-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.payout_voucher_no_seq')::text, 4, '0')
$$;

create table public.payout_vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_no text not null unique default public.next_payout_voucher_no(),
  doctor_id uuid not null references public.doctors(id),
  period_start date not null,
  period_end date not null,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  status public.voucher_status not null default 'unpaid',
  payment_reference text,
  payment_date date,
  notes text,
  generated_by uuid references auth.users(id),
  paid_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_payouts (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  invoice_no text not null,
  invoice_date date not null,
  service_id uuid references public.services(id),
  service_name text not null,
  payment_reason text not null,
  payout_amount numeric(12,2) not null check (payout_amount >= 0),
  status public.payout_status not null default 'unpaid',
  voucher_id uuid references public.payout_vouchers(id) on delete set null,
  voucher_no text,
  created_by uuid references auth.users(id),
  edited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payout_voucher_items (
  voucher_id uuid not null references public.payout_vouchers(id) on delete cascade,
  payout_id uuid not null unique references public.doctor_payouts(id) on delete restrict,
  primary key (voucher_id, payout_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  actor_name text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index doctors_active_idx on public.doctors(active);
create index services_category_idx on public.services(category);
create index invoices_date_idx on public.invoices(invoice_date);
create index invoices_doctor_idx on public.invoices(doctor_id);
create index doctor_payouts_doctor_date_idx on public.doctor_payouts(doctor_id, invoice_date);
create index doctor_payouts_status_idx on public.doctor_payouts(status);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_doctor_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select doctor_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() = 'admin'
$$;

create or replace function public.is_admin_or_accountant()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'accountant')
$$;

create or replace function public.is_staff_or_admin()
returns boolean
language sql
stable
as $$
  select public.current_user_role() in ('admin', 'staff')
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger doctors_touch_updated_at
before update on public.doctors
for each row execute function public.touch_updated_at();

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger services_touch_updated_at
before update on public.services
for each row execute function public.touch_updated_at();

create trigger doctor_payment_rules_touch_updated_at
before update on public.doctor_payment_rules
for each row execute function public.touch_updated_at();

create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function public.touch_updated_at();

create trigger doctor_payouts_touch_updated_at
before update on public.doctor_payouts
for each row execute function public.touch_updated_at();

create trigger payout_vouchers_touch_updated_at
before update on public.payout_vouchers
for each row execute function public.touch_updated_at();

create or replace function public.audit_actor_name(actor uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(full_name, actor::text) from public.profiles where id = actor
$$;

create or replace function public.write_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_summary text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    summary,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    public.audit_actor_name(auth.uid()),
    p_action,
    p_entity_type,
    p_entity_id,
    p_summary,
    p_before,
    p_after
  );
end;
$$;

create or replace function public.generate_doctor_payout_for_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice public.invoices%rowtype;
  v_rule public.doctor_payment_rules%rowtype;
  v_service public.services%rowtype;
  v_rule_type public.payout_rule_type;
  v_rule_value numeric(12,2);
  v_reason text;
  v_amount numeric(12,2);
begin
  select * into v_invoice from public.invoices where id = new.invoice_id;
  select * into v_service from public.services where id = new.service_id;

  select *
  into v_rule
  from public.doctor_payment_rules
  where doctor_id = v_invoice.doctor_id
    and (
      service_id = new.service_id or
      (service_id is null and category = new.category)
    )
  order by
    case when service_id = new.service_id then 1 else 0 end desc,
    priority desc
  limit 1;

  if found then
    v_rule_type := v_rule.rule_type;
    v_rule_value := v_rule.rule_value;
    v_reason := v_rule.reason;
  else
    v_rule_type := v_service.default_payout_type;
    v_rule_value := v_service.default_payout_value;
    v_reason := v_service.default_payout_reason;
  end if;

  if v_rule_type = 'none' then
    return new;
  elsif v_rule_type = 'percentage' then
    v_amount := round(new.line_total * v_rule_value / 100, 2);
  else
    v_amount := round(new.quantity * v_rule_value, 2);
  end if;

  if v_amount > 0 then
    insert into public.doctor_payouts (
      doctor_id,
      invoice_id,
      invoice_no,
      invoice_date,
      service_id,
      service_name,
      payment_reason,
      payout_amount,
      status,
      created_by
    )
    values (
      v_invoice.doctor_id,
      v_invoice.id,
      v_invoice.invoice_no,
      v_invoice.invoice_date,
      new.service_id,
      new.service_name,
      v_reason,
      v_amount,
      'unpaid',
      v_invoice.created_by
    );
  end if;

  return new;
end;
$$;

create trigger invoice_item_generate_doctor_payout
after insert on public.invoice_items
for each row execute function public.generate_doctor_payout_for_item();

create or replace function public.audit_invoice_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.write_audit_log(
    'invoice.created',
    'invoice',
    new.id,
    'Created invoice ' || new.invoice_no || ' for ' || new.patient_name,
    null,
    to_jsonb(new)
  );
  return new;
end;
$$;

create trigger invoices_audit_created
after insert on public.invoices
for each row execute function public.audit_invoice_created();

create or replace function public.audit_voucher_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    perform public.write_audit_log(
      'voucher.status_changed',
      'payout_voucher',
      new.id,
      'Changed voucher ' || new.voucher_no || ' from ' || old.status || ' to ' || new.status,
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger payout_vouchers_audit_status
after update on public.payout_vouchers
for each row execute function public.audit_voucher_status();

create or replace function public.audit_payout_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.payout_amount is distinct from new.payout_amount
    or old.payment_reason is distinct from new.payment_reason
    or old.status is distinct from new.status then
    perform public.write_audit_log(
      'doctor_payout.edited',
      'doctor_payout',
      new.id,
      'Edited payout for ' || new.invoice_no || ' / ' || new.service_name,
      to_jsonb(old),
      to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

create trigger doctor_payouts_audit_edit
after update on public.doctor_payouts
for each row execute function public.audit_payout_edit();

alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.services enable row level security;
alter table public.doctor_payment_rules enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.doctor_payouts enable row level security;
alter table public.payout_vouchers enable row level security;
alter table public.payout_voucher_items enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own_or_admin" on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy "profiles_admin_write" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

create policy "doctors_select_by_role" on public.doctors
for select using (
  public.current_user_role() in ('admin', 'staff', 'accountant')
  or id = public.current_doctor_id()
);

create policy "doctors_admin_write" on public.doctors
for all using (public.is_admin()) with check (public.is_admin());

create policy "services_select_authenticated" on public.services
for select using (auth.uid() is not null and active = true);

create policy "services_admin_write" on public.services
for all using (public.is_admin()) with check (public.is_admin());

create policy "doctor_rules_admin_accountant_select" on public.doctor_payment_rules
for select using (public.current_user_role() in ('admin', 'accountant'));

create policy "doctor_rules_admin_write" on public.doctor_payment_rules
for all using (public.is_admin()) with check (public.is_admin());

create policy "invoices_select_backoffice" on public.invoices
for select using (public.current_user_role() in ('admin', 'staff', 'accountant'));

create policy "invoices_staff_admin_insert" on public.invoices
for insert with check (public.is_staff_or_admin());

create policy "invoice_items_select_backoffice" on public.invoice_items
for select using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and public.current_user_role() in ('admin', 'staff', 'accountant')
  )
);

create policy "invoice_items_staff_admin_insert" on public.invoice_items
for insert with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and public.is_staff_or_admin()
  )
);

create policy "doctor_payouts_select_scoped" on public.doctor_payouts
for select using (
  public.is_admin_or_accountant()
  or doctor_id = public.current_doctor_id()
);

create policy "doctor_payouts_admin_accountant_update" on public.doctor_payouts
for update using (public.is_admin_or_accountant()) with check (public.is_admin_or_accountant());

create policy "doctor_payouts_system_insert" on public.doctor_payouts
for insert with check (public.is_staff_or_admin());

create policy "vouchers_select_backoffice" on public.payout_vouchers
for select using (public.is_admin_or_accountant());

create policy "vouchers_admin_accountant_write" on public.payout_vouchers
for all using (public.is_admin_or_accountant()) with check (public.is_admin_or_accountant());

create policy "voucher_items_select_backoffice" on public.payout_voucher_items
for select using (public.is_admin_or_accountant());

create policy "voucher_items_admin_accountant_write" on public.payout_voucher_items
for all using (public.is_admin_or_accountant()) with check (public.is_admin_or_accountant());

create policy "audit_logs_select_backoffice" on public.audit_logs
for select using (public.is_admin_or_accountant());

create policy "audit_logs_insert_authenticated" on public.audit_logs
for insert with check (auth.uid() is not null);
