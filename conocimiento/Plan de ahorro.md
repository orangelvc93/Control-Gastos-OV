---
tags: [modulo]
modulo: 3
---
# Plan de ahorro

## Implementado (fase 4, 2026-10-22)
- Pantalla **Más → Presupuesto** (`/presupuesto`), por mes.
- Ingreso base: el mismo del plan de deudas (anotado o promedio de los últimos 3 meses).
- Cada categoría de gasto se marca **necesidad** o **gusto** (botón para clasificarlas automáticamente por nombre). Ahorro y deudas = transferencias desde cuentas del día a día hacia ahorros, tarjetas o créditos.
- Porcentajes editables (deben sumar 100); barras de planeado vs. real.
- **Presupuesto por categoría** con barra; avisos `presupuesto-80` y `presupuesto-superado` (una vez por mes y categoría).
- **Fondo de emergencia**: eliges la cuenta; meses cubiertos = saldo ÷ (frecuentes de gasto llevados a mensual + cuotas de créditos).

## Distribución del ingreso
- Base: ingreso mensual = **fijos + promedio de variables**.
- La app propone repartirlo por porcentajes. Modelo por defecto **50/30/20**:
  - 50 % necesidades
  - 30 % gustos
  - 20 % ahorro / deudas
- Los porcentajes son **editables**.

## Fondo de emergencia
- Recomendación: **3 a 6 meses de gastos fijos**.
- La app muestra **cuántos meses cubro hoy**:

$$\text{meses cubiertos} = \frac{\text{saldo del fondo de emergencia}}{\text{gastos fijos mensuales}}$$

## Presupuestos y alertas
- Presupuesto por categoría.
- Alerta cuando una categoría **supera su presupuesto**.
- Alerta cuando los **gastos del mes superan los ingresos**.
Ver [[Alertas]].

## Relacionado
- [[Metas de ahorro]]
- [[Intereses]] (proyección con aportes)
- Nivel de endeudamiento: [[Plan para salir de deudas]]
