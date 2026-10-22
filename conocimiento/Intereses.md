---
tags: [modulo]
modulo: 4
---
# Intereses

Aplica a cada [[Cuentas|cuenta]] con tasa anual (ahorro, inversión, póliza).

## Implementado (fase 4, 2026-10-22) — decisión: el interés se anota a mano
> Cambio respecto al diseño original: **el usuario anota cada mes lo que le pagaron** (neto); la app no lo calcula ni lo registra sola. Lo que importa es llevar el control de lo ganado y tener un estimado del mes siguiente.
- Cuenta → Editar → **"Esta cuenta genera intereses"** (tasa opcional, capitaliza o cuenta destino, retención opcional para el SRI).
- Cuenta → pestaña **Intereses**: **Anotar interés** (mes + monto) → ingreso "Rendimientos financieros" el último día del mes, en la cuenta o en su cuenta destino (`transactions.interest_month` + `interest_account`).
- Historial mes a mes con **rendimiento anual aproximado** = interés ÷ saldo promedio diario del mes × 365 ÷ días del mes; ganado este año y en total.
- **Estimado del mes en curso**: con la tasa de la cuenta (base 360/365) o, sin tasa, con el rendimiento promedio de los últimos 3 meses anotados, sobre el saldo de hoy.
- **Más → Rendimientos**: resumen de todas las cuentas que generan intereses.
- Aviso `interes-pendiente` los días 1 a 7 si falta anotar el mes anterior.
- Código: `src/shared/lib/savings.js`, `src/app/pages/InterestPanels.jsx`, `supabase/fase4_ahorro.sql`.

## Tipo de tasa (se elige por cuenta)
- **Nominal**: interés del mes = saldo × (tasa anual ÷ 12).
- **Efectiva anual**: tasa mensual = (1 + tasa anual)^(1/12) − 1.

## Base del cálculo: saldo diario
El interés se calcula **día a día** sobre el saldo de cada día, como los bancos; el del mes es la suma de los diarios. La **base de días** (360 o 365) es configurable por cuenta.

Detalle en [[Fórmulas#Intereses de cuentas]].

## Opciones por cuenta
- **Capitalización**: si se activa, el interés se suma al saldo cada mes. Si **no** capitaliza, se elige una **cuenta destino** donde se registra el ingreso.
- **Retención en la fuente** sobre intereses: porcentaje configurable (ver [[Configuración por año (SRI)]]).
- Se registra el interés **neto** (lo que llega a la cuenta). Para el SRI se reconstruyen bruto y retención: bruto = neto ÷ (1 − %ret).

## Proyección
Muestra cuánto tendré a **6, 12 y 24 meses** con interés compuesto más mis aportes mensuales.

## Registro
Los intereses ganados se registran como **ingreso** en la categoría **"Rendimientos financieros"**, porque sirven para la declaración ([[Exportación para el SRI]]).
