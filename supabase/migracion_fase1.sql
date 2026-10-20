-- Migración a la fase 1: tablas anteriores (payments, income, savings_*) → accounts / categories / transactions.
-- Los saldos reales se dejaron en 0.00 en el repo (es público): reemplázalos antes de ejecutar.
-- Decisiones: conocimiento/Esquema de datos (fase 1).md · Respaldo previo: respaldos/respaldo-2026-10-20.*
--
-- Uso: con v_dry_run = true todo se deshace al final y el error muestra la vista previa de saldos.
--      Cuando la vista previa esté aprobada, cambiar a false y ejecutar de nuevo.
-- No modifica ni borra las tablas anteriores. Se niega a ejecutar si el usuario ya tiene cuentas.

do $$
declare
  v_dry_run constant boolean := true;
  v_today constant date := date '2026-10-20';
  v_start constant date := date '2026-01-01';
  v_user uuid;
  v_months constant text[] := array['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  a_pichincha uuid; a_metas uuid; a_tarjeta uuid; a_patronal uuid; a_personal uuid; a_extra uuid;
  c_rend uuid; c_aporte uuid;
  v_metas_legacy uuid; v_extra_legacy uuid;
  r record;
  v_cat uuid;
  v_month int;
  v_date date;
  v_transfer uuid;
  v_summary text := '';
begin
  select user_id into v_user from public.years order by created_at limit 1;
  if v_user is null then raise exception 'No hay datos anteriores para migrar'; end if;
  if exists (select 1 from public.accounts where user_id = v_user) then
    raise exception 'El usuario ya tiene cuentas: la migración ya se hizo';
  end if;

  -- Cuentas reales (saldos indicados por el usuario el 2026-10-20) --------
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, sort_order, color)
  values (v_user, 'Pichincha Ahorros', 'Banco Pichincha', 'ahorro', 0, v_start, 1, 'yellow') returning id into a_pichincha;
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, sort_order, color)
  values (v_user, 'Metas', 'Banco Guayaquil', 'ahorro', 0, v_start, 2, 'blue') returning id into a_metas;
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, credit_limit, statement_day, due_day, sort_order, color)
  values (v_user, 'Tarjeta Pichincha', 'Banco Pichincha', 'tarjeta_credito', 0, v_start, null, 23, 8, 3, 'red') returning id into a_tarjeta;
  -- Sin historial: el saldo de hoy es su saldo inicial.
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, sort_order, color)
  values (v_user, 'Anefi Patronal', 'Anefi', 'inversion', 0.00, v_today, 4, 'green') returning id into a_patronal;
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, sort_order, color)
  values (v_user, 'Anefi Personal', 'Anefi', 'inversion', 0.00, v_today, 5, 'green') returning id into a_personal;
  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, sort_order, color)
  values (v_user, 'Anefi Extraordinaria', 'Anefi', 'inversion', 0, v_start, 6, 'green') returning id into a_extra;

  -- Categorías ------------------------------------------------------------
  insert into public.categories (user_id, name, kind, is_system, tax_income_type)
  values (v_user, 'Rendimientos financieros', 'ingreso', true, 'rendimientos_financieros') returning id into c_rend;
  insert into public.categories (user_id, name, kind, tax_income_type)
  values (v_user, 'Aportes fideicomiso (rol)', 'ingreso', 'relacion_dependencia') returning id into c_aporte;
  insert into public.categories (user_id, name, kind, tax_income_type) values
    (v_user, 'Sueldo Solca', 'ingreso', 'relacion_dependencia'),
    (v_user, 'Gensystems', 'ingreso', 'honorarios'),
    (v_user, 'Pagos extra', 'ingreso', 'otros'),
    (v_user, 'Otros ingresos', 'ingreso', 'otros');
  insert into public.categories (user_id, name, kind, sri_category) values
    (v_user, 'Arriendo', 'gasto', 'vivienda'),
    (v_user, 'Luz', 'gasto', 'vivienda'),
    (v_user, 'Agua', 'gasto', 'vivienda'),
    (v_user, 'Internet', 'gasto', null),
    (v_user, 'Plan Claro', 'gasto', null),
    (v_user, 'Curso Inglés', 'gasto', 'educacion'),
    (v_user, 'Spotify', 'gasto', null),
    (v_user, 'ChatGPT', 'gasto', null),
    (v_user, 'Alimentación', 'gasto', 'alimentacion'),
    (v_user, 'Salud', 'gasto', 'salud'),
    (v_user, 'Vestimenta', 'gasto', 'vestimenta'),
    (v_user, 'Transporte', 'gasto', null),
    (v_user, 'Otros gastos', 'gasto', null);

  -- Pagos "Pagado" ------------------------------------------------------
  for r in select * from public.payments where user_id = v_user and status = 'Pagado' order by date, created_at loop
    if trim(r.category) in ('Pago tarjeta', 'Pichincha') then
      -- Pago de la tarjeta: transferencia Pichincha → Tarjeta (no es gasto).
      v_transfer := gen_random_uuid();
      insert into public.transactions (user_id, account_id, date, amount, kind, transfer_id, description, legacy_ref) values
        (v_user, a_pichincha, r.date, -r.amount, 'transferencia', v_transfer, 'Pago tarjeta: ' || r.concept, 'payments:' || r.id || ':out'),
        (v_user, a_tarjeta, r.date, r.amount, 'transferencia', v_transfer, 'Pago tarjeta: ' || r.concept, 'payments:' || r.id || ':in');
    else
      select id into v_cat from public.categories
      where user_id = v_user and kind = 'gasto'
        and lower(name) = lower(case trim(r.category) when 'Curso Ingles' then 'Curso Inglés' else trim(r.category) end);
      if v_cat is null then raise exception 'Categoría de gasto sin mapear: %', r.category; end if;
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, legacy_ref)
      values (v_user, a_pichincha, r.date, -r.amount, 'gasto', v_cat, r.concept, 'payments:' || r.id);
    end if;
  end loop;

  -- Ingresos "Pagado" ---------------------------------------------------
  for r in select * from public.income where user_id = v_user and status = 'Pagado' order by date, created_at loop
    if trim(r.source) = 'Interés Guayaquil' then
      -- Interés de la cuenta Metas (las filas de ahorro tienen los mismos intereses: se usan estos, que traen fecha real).
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, legacy_ref)
      values (v_user, a_metas, r.date, r.amount, 'ingreso', c_rend, 'Interés ' || r.month, 'income:' || r.id);
    elsif trim(r.source) = 'Pichincha' then
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, legacy_ref)
      values (v_user, a_pichincha, r.date, r.amount, 'ingreso', c_rend, coalesce(nullif(r.concept, ''), 'Intereses Pichincha'), 'income:' || r.id);
    else
      select id into v_cat from public.categories
      where user_id = v_user and kind = 'ingreso'
        and lower(name) = lower(case trim(r.source) when 'Pagos Extra' then 'Pagos extra' else trim(r.source) end);
      if v_cat is null then raise exception 'Categoría de ingreso sin mapear: %', r.source; end if;
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, legacy_ref)
      values (v_user, a_pichincha, r.date, r.amount, 'ingreso', v_cat, r.concept, 'income:' || r.id);
    end if;
  end loop;

  -- Ahorros: Metas Guayaquil ---------------------------------------------
  select id into v_metas_legacy from public.savings_accounts where user_id = v_user and name = 'Metas Guayaquil';
  for r in
    select e.*, row_number() over (order by e.position nulls last, e.created_at) as n
    from public.savings_entries e where e.account_id = v_metas_legacy
  loop
    if r.n = 1 then
      update public.accounts set opening_balance = r.initial where id = a_metas;
    end if;
    -- La posición indica el mes (pos. 2 = Enero … pos. 8 = Julio, aunque esa fila diga "Mayo").
    v_month := least(greatest(coalesce(r.position, r.n + 1) - 1, 1), 12);
    v_date := make_date(2026, v_month, 1);
    if r.deposit > 0 then
      v_transfer := gen_random_uuid();
      insert into public.transactions (user_id, account_id, date, amount, kind, transfer_id, description, note, legacy_ref) values
        (v_user, a_pichincha, v_date, -r.deposit, 'transferencia', v_transfer, 'Depósito a Metas ' || v_months[v_month], 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':dep-out'),
        (v_user, a_metas, v_date, r.deposit, 'transferencia', v_transfer, 'Depósito a Metas ' || v_months[v_month], 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':dep-in');
    end if;
    if r.withdrawal > 0 then
      v_transfer := gen_random_uuid();
      insert into public.transactions (user_id, account_id, date, amount, kind, transfer_id, description, note, legacy_ref) values
        (v_user, a_metas, v_date, -r.withdrawal, 'transferencia', v_transfer, 'Retiro de Metas ' || v_months[v_month], 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':ret-out'),
        (v_user, a_pichincha, v_date, r.withdrawal, 'transferencia', v_transfer, 'Retiro de Metas ' || v_months[v_month], 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':ret-in');
    end if;
    -- Intereses de Metas: ya migrados desde los ingresos "Interés Guayaquil".
  end loop;

  -- Ahorros: Fideicomiso Extraordinario → Anefi Extraordinaria -----------
  select id into v_extra_legacy from public.savings_accounts where user_id = v_user and name = 'Fideicomiso Extraordinario';
  for r in
    select e.*, array_position(v_months, e.description) as m,
           row_number() over (order by array_position(v_months, e.description), e.created_at) as n
    from public.savings_entries e where e.account_id = v_extra_legacy
  loop
    if r.n = 1 then
      update public.accounts set opening_balance = r.initial where id = a_extra;
    end if;
    v_date := make_date(2026, r.m, 1);
    if r.deposit > 0 then
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, note, legacy_ref)
      values (v_user, a_extra, v_date, r.deposit, 'ingreso', c_aporte, 'Aporte por rol ' || r.description, 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':dep');
    end if;
    if r.interest > 0 then
      insert into public.transactions (user_id, account_id, date, amount, kind, category_id, description, note, legacy_ref)
      values (v_user, a_extra, (v_date + interval '1 month - 1 day')::date, r.interest, 'ingreso', c_rend, 'Rendimiento ' || r.description, 'Fecha aproximada: el registro original solo tenía el mes.', 'savings_entries:' || r.id || ':int');
    end if;
  end loop;

  -- Ajustes de migración: cuadrar con el saldo real de hoy ----------------
  for r in
    select a.id, a.name, b.balance, real.amount as real_balance
    from public.accounts a
    join public.account_balances b on b.account_id = a.id
    join (values
      (a_pichincha, 0.00::numeric), (a_metas, 0.00), (a_tarjeta, 0.00),
      (a_patronal, 0.00), (a_personal, 0.00), (a_extra, 0.00)
    ) as real(account_id, amount) on real.account_id = a.id
    order by a.sort_order
  loop
    if r.real_balance - r.balance <> 0 then
      insert into public.transactions (user_id, account_id, date, amount, kind, description, note, legacy_ref)
      values (v_user, r.id, v_today, r.real_balance - r.balance, 'ajuste', 'Ajuste de migración',
        format('Saldo calculado con el historial: %s. Saldo real al %s: %s. La diferencia corresponde a movimientos que no se registraron.', r.balance, v_today, r.real_balance),
        'ajuste-migracion:' || r.id);
    end if;
    v_summary := v_summary || format(E'\n%s: historial %s → ajuste %s → saldo %s', r.name, r.balance, r.real_balance - r.balance, r.real_balance);
  end loop;

  v_summary := v_summary || format(E'\nMovimientos creados: %s · Categorías: %s',
    (select count(*) from public.transactions where user_id = v_user),
    (select count(*) from public.categories where user_id = v_user));

  if v_dry_run then
    raise exception 'VISTA PREVIA (no se guardó nada):%', v_summary;
  end if;
  raise notice 'Migración completada:%', v_summary;
end $$;

select a.name, a.type, b.balance
from public.accounts a join public.account_balances b on b.account_id = a.id
order by a.sort_order;
