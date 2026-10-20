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

## Pendiente según la [[Hoja de ruta]]
- Fase 2: generación automática de frecuentes (`pg_cron`), avisos en la app + push + Telegram.
- Fase 3: [[Créditos y préstamos]], diferidos y estado de cuenta de [[Tarjetas de crédito]], [[Plan para salir de deudas]].
- Fase 4: [[Intereses]] calculados, [[Plan de ahorro]] 50/30/20, [[Metas de ahorro]].
- Fase 5: [[Facturas y gastos deducibles]], [[Reportes y exportación]], [[Exportación para el SRI]].
- Fase 6: [[Lista de compras]].
