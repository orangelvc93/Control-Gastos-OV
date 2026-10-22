-- Fase 4b · Precancelar diferidos (todo o solo algunas cuotas).
-- Requiere fase3b_creditos.sql. Idempotente. Diseño: conocimiento/Tarjetas de crédito.md.
-- Las últimas prepaid_count cuotas no se cobran por separado: su capital se cobra en el corte prepaid_cut
-- y sus intereses ya no se generan. El cálculo es el mismo que installmentSchedule() en src/shared/lib/cards.js.

alter table public.card_installments add column if not exists prepaid_cut date;
alter table public.card_installments add column if not exists prepaid_count smallint check (prepaid_count is null or prepaid_count > 0);

-- Cuotas sin precancelación (antes era card_installment_rows).
create or replace function public.card_installment_base_rows(p_plan uuid)
returns table (n int, cut date, capital numeric, interest numeric)
language plpgsql stable set search_path = '' as $$
declare
  v_plan public.card_installments;
  v_acct public.accounts;
  v_factor numeric;
  v_rate numeric;
  v_balance numeric;
  v_payment numeric;
  v_interest numeric;
  v_capital numeric;
  v_total_interest numeric;
begin
  select * into v_plan from public.card_installments where id = p_plan;
  select * into v_acct from public.accounts where id = v_plan.account_id;
  v_balance := v_plan.principal * 100;

  if v_plan.with_interest then
    v_factor := nullif((v_acct.deferral_factors ->> v_plan.months::text)::numeric, 0);
  end if;

  if v_factor is not null then
    v_total_interest := round(v_balance * v_factor / 100);
    for i in 1..v_plan.months loop
      n := i;
      cut := public.card_cut(v_plan.first_cut, i - 1, v_acct.statement_day);
      capital := (case when i = v_plan.months then v_balance - floor(v_balance / v_plan.months) * (v_plan.months - 1) else floor(v_balance / v_plan.months) end) / 100;
      interest := (case when i = v_plan.months then v_total_interest - floor(v_total_interest / v_plan.months) * (v_plan.months - 1) else floor(v_total_interest / v_plan.months) end) / 100;
      return next;
    end loop;
    return;
  end if;

  if v_plan.with_interest and coalesce(v_acct.interest_rate, 0) > 0 then
    v_rate := case when v_acct.rate_type = 'efectiva'
      then power(1 + v_acct.interest_rate / 100, 1.0 / 12) - 1
      else v_acct.interest_rate / 100 / 12 end;
  end if;
  v_payment := case when v_rate is null then floor(v_balance / v_plan.months)
    else round(v_balance * v_rate / (1 - power(1 + v_rate, -v_plan.months))) end;

  for i in 1..v_plan.months loop
    v_interest := case when v_rate is null then 0 else round(v_balance * v_rate) end;
    v_capital := case when i = v_plan.months then v_balance else least(v_balance, v_payment - v_interest) end;
    v_balance := v_balance - v_capital;
    n := i;
    cut := public.card_cut(v_plan.first_cut, i - 1, v_acct.statement_day);
    capital := v_capital / 100;
    interest := v_interest / 100;
    return next;
  end loop;
end;
$$;

-- Cuotas reales: aplica la precancelación (la usan el estado de cuenta, los intereses y los avisos).
create or replace function public.card_installment_rows(p_plan uuid)
returns table (n int, cut date, capital numeric, interest numeric)
language plpgsql stable set search_path = '' as $$
declare
  v_plan public.card_installments;
  v_total int;
  v_keep int;
  v_prepaid numeric;
  v_found boolean := false;
  r record;
begin
  select * into v_plan from public.card_installments where id = p_plan;
  if v_plan.prepaid_cut is null or coalesce(v_plan.prepaid_count, 0) = 0 then
    return query select * from public.card_installment_base_rows(p_plan);
    return;
  end if;

  select count(*) into v_total from public.card_installment_base_rows(p_plan);
  v_keep := greatest(0, v_total - v_plan.prepaid_count);
  select coalesce(sum(b.capital), 0) into v_prepaid from public.card_installment_base_rows(p_plan) b where b.n > v_keep;

  for r in select * from public.card_installment_base_rows(p_plan) b where b.n <= v_keep order by b.n loop
    n := r.n; cut := r.cut; capital := r.capital; interest := r.interest;
    if r.cut = v_plan.prepaid_cut then
      capital := capital + v_prepaid;
      v_found := true;
    end if;
    return next;
  end loop;

  -- La precancelación cae en un corte sin cuota propia (por ejemplo, antes de la primera).
  if not v_found then
    n := v_keep + 1; cut := v_plan.prepaid_cut; capital := v_prepaid; interest := 0;
    return next;
  end if;
end;
$$;
