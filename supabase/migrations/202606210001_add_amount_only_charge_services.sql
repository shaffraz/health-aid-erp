insert into public.services (
  name,
  category,
  selling_price,
  default_payout_type,
  default_payout_value,
  default_payout_reason,
  active
)
select
  'Medication Charges',
  'Consumables'::public.service_category,
  0,
  'none'::public.payout_rule_type,
  0,
  'Medication charges do not generate doctor payout',
  true
where not exists (
  select 1 from public.services where name = 'Medication Charges'
);

insert into public.services (
  name,
  category,
  selling_price,
  default_payout_type,
  default_payout_value,
  default_payout_reason,
  active
)
select
  'Consumables Charges',
  'Consumables'::public.service_category,
  0,
  'none'::public.payout_rule_type,
  0,
  'Consumables charges do not generate doctor payout',
  true
where not exists (
  select 1 from public.services where name = 'Consumables Charges'
);

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

  if v_service.name in ('Medication Charges', 'Consumables Charges') then
    return new;
  end if;

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
