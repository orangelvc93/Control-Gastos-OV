-- Inicio de la fase 1 (decisión del 2026-10-20): se empieza de cero, sin migrar el historial.
-- Los saldos se dejaron en 0.00 en el repo (es público): al ejecutarlo, reemplázalos por los saldos reales de cada cuenta.
-- Cada cuenta arranca hoy con su saldo real como saldo inicial; el historial anterior queda en las
-- tablas antiguas (payments, income, savings_*) y en respaldos/respaldo-2026-10-20.*
-- (migracion_fase1.sql queda como referencia por si algún día se quiere migrar el historial).

do $$
declare
  v_today constant date := date '2026-10-20';
  v_user uuid;
begin
  select user_id into v_user from public.years order by created_at limit 1;
  if v_user is null then raise exception 'No se encontró el usuario'; end if;
  if exists (select 1 from public.accounts where user_id = v_user) then
    raise exception 'El usuario ya tiene cuentas';
  end if;

  insert into public.accounts (user_id, name, institution, type, opening_balance, opening_date, credit_limit, statement_day, due_day, sort_order, color) values
    (v_user, 'Pichincha Ahorros', 'Banco Pichincha', 'ahorro', 0.00, v_today, null, null, null, 1, 'yellow'),
    (v_user, 'Metas', 'Banco Guayaquil', 'ahorro', 0.00, v_today, null, null, null, 2, 'blue'),
    (v_user, 'Tarjeta Pichincha', 'Banco Pichincha', 'tarjeta_credito', 0.00, v_today, null, 23, 8, 3, 'red'),
    (v_user, 'Anefi Patronal', 'Anefi', 'inversion', 0.00, v_today, null, null, null, 4, 'green'),
    (v_user, 'Anefi Personal', 'Anefi', 'inversion', 0.00, v_today, null, null, null, 5, 'green'),
    (v_user, 'Anefi Extraordinaria', 'Anefi', 'inversion', 0.00, v_today, null, null, null, 6, 'green');

  insert into public.categories (user_id, name, kind, is_system, tax_income_type, sri_category) values
    (v_user, 'Rendimientos financieros', 'ingreso', true, 'rendimientos_financieros', null),
    (v_user, 'Sueldo Solca', 'ingreso', false, 'relacion_dependencia', null),
    (v_user, 'Aportes fideicomiso (rol)', 'ingreso', false, 'relacion_dependencia', null),
    (v_user, 'Gensystems', 'ingreso', false, 'honorarios', null),
    (v_user, 'Pagos extra', 'ingreso', false, 'otros', null),
    (v_user, 'Otros ingresos', 'ingreso', false, 'otros', null),
    (v_user, 'Arriendo', 'gasto', false, null, 'vivienda'),
    (v_user, 'Luz', 'gasto', false, null, 'vivienda'),
    (v_user, 'Agua', 'gasto', false, null, 'vivienda'),
    (v_user, 'Internet', 'gasto', false, null, null),
    (v_user, 'Plan Claro', 'gasto', false, null, null),
    (v_user, 'Curso Inglés', 'gasto', false, null, 'educacion'),
    (v_user, 'Spotify', 'gasto', false, null, null),
    (v_user, 'ChatGPT', 'gasto', false, null, null),
    (v_user, 'Alimentación', 'gasto', false, null, 'alimentacion'),
    (v_user, 'Salud', 'gasto', false, null, 'salud'),
    (v_user, 'Vestimenta', 'gasto', false, null, 'vestimenta'),
    (v_user, 'Transporte', 'gasto', false, null, null),
    (v_user, 'Otros gastos', 'gasto', false, null, null);
end $$;

select a.name, a.type, b.balance
from public.accounts a join public.account_balances b on b.account_id = a.id
order by a.sort_order;
