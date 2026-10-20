---
tags: [referencia]
---
# Fórmulas

Regla: calcular con precisión completa y **redondear a 2 decimales solo al final** ([[Reglas generales]]).

## Saldo de una cuenta
$$\text{saldo} = S_0 + \sum\text{ingresos} - \sum\text{gastos} \pm \sum\text{transferencias} + \sum\text{intereses}$$

## Intereses de cuentas
Sea $r$ la tasa anual en decimal (5 % → 0,05).

- **Tasa nominal**: $i_m = r / 12$
- **Tasa efectiva anual**: $i_m = (1 + r)^{1/12} - 1$
- **Interés del mes (estimación simple)**: $I = \text{saldo} \times i_m$
- **Interés diario (cálculo oficial de la app)**, con base $B$ = 360 o 365 según la cuenta:
  - nominal: $i_d = r / B$; efectiva: $i_d = (1 + r)^{1/B} - 1$
  - interés del mes $= \sum_{\text{días}} \text{saldo del día} \times i_d$
- **Retención**: se registra el neto $N$; bruto $= N / (1 - \%\text{ret})$; retención $=$ bruto $- N$.

## Proyección con aportes (interés compuesto)
Saldo inicial $S_0$, aporte mensual $A$, tasa mensual $i_m$, meses $n$ (6, 12, 24):

$$S_n = S_0 (1 + i_m)^n + A \cdot \frac{(1 + i_m)^n - 1}{i_m}$$

Si $i_m = 0$: $S_n = S_0 + A \cdot n$.

## Metas de ahorro
Aporte mensual necesario para llegar a $M$ en $n$ meses, con ahorro actual $S_0$:

- Sin interés: $A = (M - S_0) / n$
- Con interés: $A = \dfrac{(M - S_0(1+i_m)^n)\, i_m}{(1+i_m)^n - 1}$

## Fondo de emergencia
$$\text{meses cubiertos} = \frac{\text{saldo del fondo}}{\text{gastos fijos mensuales}}$$

## Créditos
$P$ = monto, $n$ = meses, $i$ = tasa mensual:
- tasa **nominal**: $i = r / 12$
- tasa **efectiva anual (TEA)**: $i = (1 + r)^{1/12} - 1$

### Sin intereses
$$C = P / n$$

### Sistema francés (cuota fija)
$$C = \frac{P \cdot i}{1 - (1 + i)^{-n}}$$
Cada mes: interés $= \text{saldo} \times i$; capital $= C - \text{interés}$; saldo $= \text{saldo} - \text{capital}$.

### Sistema alemán (capital fijo)
Capital fijo $= P / n$; interés del mes $= \text{saldo} \times i$; cuota $= \text{capital} + \text{interés}$ (decreciente).

### Totales
Total pagado $= \sum C_k$ (+ seguros/cargos); intereses totales $= \text{total pagado} - P$.

## Tarjetas de crédito
- Cupo disponible $=$ cupo $-$ deuda total.
- Diferido sin intereses: cuota $=$ monto $/$ meses.
- Diferido con intereses: misma fórmula del sistema francés, siempre con la **tasa de la tarjeta**.
- Interés por pago parcial (diario): $\sum_{\text{días hasta el corte}} \text{saldo pendiente} \times i_d$.
- Estado de cuenta $=$ corrientes del período $+$ cuotas de diferidos del mes $+$ intereses/cargos.

## Endeudamiento
$$\%\text{deuda} = \frac{\text{pago mensual total de deudas}}{\text{ingreso mensual}} \quad (\text{alerta si} > 30\text{–}35\%)$$
