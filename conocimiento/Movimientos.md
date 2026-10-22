---
tags: [modulo]
modulo: 2
---
# Movimientos (ingresos y gastos)

Puedo agregar o quitar dinero de cualquier [[Cuentas|cuenta]].

## Datos de un movimiento
| Campo | Notas |
|---|---|
| Fecha | |
| Monto | |
| Categoría | categorías editables |
| Descripción | |
| Nota | opcional |

## Categorías
- Editables por el usuario.
- Categoría especial **"Rendimientos financieros"** para los intereses ganados (ver [[Intereses]]).
- Cada gasto puede marcarse como **deducible** y asignarse a una categoría del SRI (ver [[Facturas y gastos deducibles]]).

## Relacionado
- Ingresos y gastos fijos que se repiten: [[Movimientos recurrentes]].
- Consumos con tarjeta: se registran como gasto en su categoría pero suman a la deuda de la tarjeta ([[Tarjetas de crédito]]).
- Compras de la [[Lista de compras]] pueden convertirse en gasto.

## Ingresos que no son dinero disponible

Una categoría de ingreso puede desmarcar **"Cuenta como ingreso disponible"** (Más → Categorías). Sirve para aportes que el trabajo deposita directo en un fondo (por ejemplo Anefi patronal, personal o extraordinaria): el movimiento suma al saldo de esa cuenta, pero no cuenta en los ingresos del mes, el Dashboard, el presupuesto 50/30/20, el % de endeudamiento ni el aviso "gastas más de lo que entra" (`categories.counts_as_income`, `isAvailableIncome()`, `public.is_available_income`). Se registran como frecuentes de ingreso fijo en cada cuenta del fondo; los intereses se siguen anotando aparte en [[Intereses]].
