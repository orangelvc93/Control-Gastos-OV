---
tags: [modulo]
modulo: 2
---
# Movimientos recurrentes

Ingresos fijos (sueldo, arriendos cobrados…) y gastos fijos (servicios, suscripciones, cuotas, arriendo pagado…).

## Configuración
| Campo | Valores |
|---|---|
| Tipo | ingreso o gasto |
| Frecuencia | semanal · quincenal · mensual · anual |
| Fecha de inicio | |
| Fecha de fin | opcional |
| Cuenta, categoría, monto, descripción | igual que en [[Movimientos]] |

## Implementado (2026-10-20)
- Tabla `recurring_items` (`supabase/fase1b_frecuentes.sql`) y pantalla **Gestión → Gastos e ingresos frecuentes**.
- Tipos: gasto fijo, ingreso fijo y **ahorro/pago** (transferencia entre cuentas, p. ej. ahorro mensual a Metas).
- **Quincenal** = dos veces al mes: el día de inicio y 15 días después (1 y 16, 15 y 30…). **Mensual** en día 31 → último día de meses cortos.
- Los pendientes (vencidos hasta 31 días y próximos 7–15 días) aparecen en **Inicio → Por registrar** y en Gestión; se registran con un toque (formulario prellenado, se puede ajustar el monto solo para ese registro).
- Cada movimiento guarda `recurring_id` + `occurrence_date`, así una fecha nunca se registra dos veces.
- Editar un frecuente cambia solo las **próximas** fechas ("este y los siguientes"); editar un movimiento ya registrado cambia solo ese ("solo este").
- **Falta (fase 2)**: generación automática diaria en el servidor (`pg_cron`) y alertas push/Telegram.

## Comportamiento
- La app **genera los movimientos sola** en su fecha, **en el servidor**: una tarea diaria (`pg_cron` en Supabase) crea los vencidos aunque no abra la app, sin duplicar nunca.
- **Avisa de los que vienen** (ver [[Alertas]]).
- Al editar o eliminar uno, pregunta si aplica a **"solo este"** o a **"este y los siguientes"**.
- Las cuotas de [[Créditos y préstamos]] se crean automáticamente como recurrentes.
