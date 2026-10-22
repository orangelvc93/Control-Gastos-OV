---
tags: [desarrollo]
actualizado: 2026-10-20
---
# Estado actual de la app

## Fase 1 (hecha el 2026-10-20, sin commit todavía)
App nueva, primero para celular y como **web app instalable (PWA)**:

| Pantalla | Qué hace |
|---|---|
| **Inicio** | Patrimonio neto explicado (tengo − debo), Disponible, Ahorros, Deuda en tarjetas con cupo libre, resumen del mes, pendientes por registrar, cuentas y últimos movimientos |
| **Movimientos** | Lista por día con navegación por mes, filtros (tipo, cuenta, búsqueda) e ingresos/gastos/balance del mes |
| **Cuentas** | Agrupadas en Disponible / Ahorros e inversiones / Tarjetas; detalle con "¿De dónde sale este saldo?", saldo después de cada movimiento, ajustar saldo, editar, archivar |
| **Gestión** | Crear cuentas por tipo (ahorros, corriente, tarjeta de crédito, efectivo, inversión, póliza; débito explicado), gastos/ingresos frecuentes, pendientes |
| **Más** | Gestión, Categorías (con categoría SRI), Papelera (restaurar / eliminar para siempre), Histórico 2026 (app anterior), Salir |
| **Botón +** | Gasto, ingreso o transferencia en un formulario con validación |

- Datos: [[Esquema de datos (fase 1)]] — cuentas, categorías, movimientos, frecuentes, historial automático (`audit_log`).
- Se empezó de cero con los saldos reales del 2026-10-20; el histórico anterior se consulta en Más → Histórico 2026.
- Cálculo en centavos enteros; cada guardado toca solo su fila.

## Fase 2 (hecha el 2026-10-20)
- `supabase/fase2_automatizacion.sql`: tarea diaria `control-gastos-diario` (pg_cron, 06:00 Ecuador) + al abrir la app.
- Frecuentes con **monto fijo** → se registran confirmados; **variables** → pendientes ("Por confirmar" en Inicio).
- Avisos en la campana (`notifications`): frecuente registrado, próximos (N días), pago de tarjeta por vencer, uso alto del cupo, gastos > ingresos del mes. Ajustes en **Avisos y Telegram**.
- Telegram vía `pg_net`; el token del bot va en el Vault (`telegram_bot_token`).
- **Push del navegador**: `supabase/fase2b_push.sql` (suscripciones por dispositivo, envío en la tarea diaria) y la función del servidor `supabase/functions/push` (desplegada desde el panel de Supabase, con "Verify JWT" desactivado: ella misma valida la sesión o la clave de la tarea). Las claves VAPID las genera la función y quedan en `push_config`, que solo lee el servidor.
- Avisos filtrables por tipo; al editar o eliminar un registro de un frecuente se elige **solo este / este y los siguientes**.
- **Dashboard** con gráficas (ingresos vs gastos por mes, patrimonio neto, gastos/ingresos por categoría, saldo por cuenta, uso de tarjetas), periodos y vista de tabla.
- Campo de fecha escribible en el celular (dd/mm/aaaa + Hoy/Ayer + calendario).
- Regla: un movimiento con fecha anterior al saldo inicial de su cuenta no cambia el saldo (app y vista `account_balances`).

## Fase 3 · Tarjetas (2026-10-20)
- Ver [[Tarjetas de crédito#Implementado (fase 3, 2026-10-20)]]: diferidos con y sin intereses, estado de cuenta por corte, pago guiado, mínimo anotado o estimado, avisos de corte / pago / atraso.
- Detalle de la tarjeta con pestañas: Resumen, Estado de cuenta, Diferidos y Movimientos. La cuenta tarjeta tiene tasa anual y % de mínimo estimado.

## Fase 3 · Créditos (2026-10-20)
- Ver [[Créditos y préstamos#Implementado (fase 3, 2026-10-20)]]: cuenta de deuda + cuotas automáticas (interés gasto, capital transferencia), tabla de pagos y simulador de abonos.
- Tarjeta: factores de diferido del banco por plazo.

## Fase 3 · Plan de deudas (2026-10-20)
- Ver [[Plan para salir de deudas#Implementado (fase 3, 2026-10-20)]]: % de ingresos en deudas, avalancha vs. bola de nieve, simulador antes de endeudarte y aviso de endeudamiento alto.

## Fase 4 · Ahorro (2026-10-22)
- [[Intereses]] anotados a mano con historial, rendimiento aproximado y estimado; [[Plan de ahorro]] 50/30/20 con presupuestos por categoría y fondo de emergencia; [[Metas de ahorro]].

## Pendiente según la [[Hoja de ruta]]
- Fase 5: [[Facturas y gastos deducibles]], [[Reportes y exportación]], [[Exportación para el SRI]].
- Fase 6: [[Lista de compras]].
