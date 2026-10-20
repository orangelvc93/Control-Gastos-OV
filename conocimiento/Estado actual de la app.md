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
- Telegram vía `pg_net`; el token del bot va en el Vault (`telegram_bot_token`). Push del navegador: pendiente.
- **Dashboard** con gráficas (ingresos vs gastos por mes, patrimonio neto, gastos/ingresos por categoría, saldo por cuenta, uso de tarjetas), periodos y vista de tabla.
- Campo de fecha escribible en el celular (dd/mm/aaaa + Hoy/Ayer + calendario).
- Regla: un movimiento con fecha anterior al saldo inicial de su cuenta no cambia el saldo (app y vista `account_balances`).

## Pendiente según la [[Hoja de ruta]]
- Fase 2: notificaciones push del navegador (PWA).
- Fase 3: [[Créditos y préstamos]], diferidos y estado de cuenta de [[Tarjetas de crédito]], [[Plan para salir de deudas]].
- Fase 4: [[Intereses]] calculados, [[Plan de ahorro]] 50/30/20, [[Metas de ahorro]].
- Fase 5: [[Facturas y gastos deducibles]], [[Reportes y exportación]], [[Exportación para el SRI]].
- Fase 6: [[Lista de compras]].
