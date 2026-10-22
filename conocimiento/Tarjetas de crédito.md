---
tags: [modulo, deudas]
modulo: 4B
---
# Tarjetas de crédito

## Implementado (fase 3, 2026-10-20)
- `supabase/fase3_tarjetas.sql` + `src/shared/lib/cards.js` (mismos cálculos en el servidor y en la app).
- **Compra diferida**: al registrar un gasto con la tarjeta se elige *Corriente* o *Diferido a meses* (3–48) con o sin intereses; se ve la cuota, la primera y la última fecha y el interés total. La compra es un gasto por el total (baja el cupo y cuenta en su categoría ese día); el diferido (`card_installments`) solo dice cómo se cobra: una cuota de capital por corte, empezando por el corte que incluye la fecha de compra.
- **Factores del banco** (Editar tarjeta → Tasa y factores de diferido): interés total del diferido = monto × factor según el plazo (ej. 12 meses 8,76 %), repartido en cuotas iguales. Si el plazo no tiene factor, se usa el sistema francés con la tasa de la tarjeta.
- **Intereses de diferidos**: la tarea diaria registra el día de cada corte un gasto "Interés diferido: … (k/n)" en la categoría *Intereses y comisiones* (nunca dos veces la misma cuota).
- **Diferidos que ya tenías** (dentro del saldo inicial): Tarjeta → Diferidos → *Agregar uno que ya tenías*, con monto original, meses y cuotas ya cobradas. No suman deuda; solo hacen que el estado de cuenta pida la cuota.
- **Precancelar un diferido** (Tarjeta → Diferidos → *Precancelar*): todo lo que falta o solo algunas cuotas (se descuentan las últimas; la cuota mensual no cambia y el diferido termina antes). El capital precancelado se cobra en el próximo corte junto con la cuota de ese mes y esas cuotas dejan de generar intereses (`prepaid_cut`, `prepaid_count`). No mueve dinero: el pago se registra como cualquier pago de la tarjeta. Se puede deshacer.
- **Estado de cuenta** por corte (ciclo del día siguiente al corte anterior hasta el corte): saldo anterior + consumos corrientes + cuotas + intereses + ajustes − pagos − devoluciones. Total a pagar = deuda al corte − capital de diferidos que aún no se cobra.
- **Pago mínimo**: se anota del estado del banco (`card_statements`, junto con el total del banco para comparar); si falta, se estima con el % de la tarjeta (10 % por defecto) y se marca "estimado".
- **Pagar tarjeta**: total que falta, solo el mínimo, toda la deuda u otro monto; si queda saldo, muestra el interés diario estimado hasta el siguiente corte. Se registra como transferencia.
- **Avisos**: estado de cuenta listo (`tarjeta-corte`), pago por vencer con lo que falta (`tarjeta-pago`), pago atrasado si no se cubrió el mínimo (`tarjeta-atrasado`) y uso alto del cupo.
- El primer estado de cuenta en la app es el del primer corte posterior al saldo inicial; antes no hay datos para calcularlo.

## Datos
| Campo | Notas |
|---|---|
| Nombre | |
| Banco | |
| Cupo total | |
| Fecha de corte | |
| Fecha máxima de pago | |
| Tasa de interés anual | por mora o revolvente |

## Lo que la app muestra siempre
- Deuda total
- **Cupo disponible** = cupo − deuda total
- Lo que debo pagar este mes y la fecha límite

## Consumos
Cada consumo se registra como **gasto en su categoría** (cuenta para presupuestos e impuestos), pero **suma a la deuda de la tarjeta**; no resta de una cuenta bancaria.

| Tipo | Cómo se paga |
|---|---|
| Corriente | completo en el siguiente corte |
| Diferido sin intereses | monto ÷ número de meses, cuotas iguales |
| Diferido con intereses | cuota con la fórmula de amortización ([[Fórmulas#Sistema francés (cuota fija)]]), usando **siempre la tasa de la tarjeta** |

Por cada diferido: **cuota mensual**, **cuotas pagadas / totales**, **saldo pendiente** y **fecha de la última cuota**.

## Estado de cuenta mensual
$$\text{estado} = \text{consumos corrientes del período} + \text{cuotas de diferidos del mes} + \text{intereses o cargos}$$

## Pagos
- Pagar la tarjeta es una **transferencia** desde una cuenta bancaria hacia la tarjeta: baja la deuda y **no se cuenta otra vez como gasto** ([[Cuentas#Transferencias]]).
- Si pago **menos del total**, la app calcula el interés **diario** sobre el saldo pendiente hasta el siguiente corte y advierte cuánto cuesta pagar solo el mínimo.
- **Pago mínimo**: lo ingreso cada mes desde el estado de cuenta. Si no lo ingreso, se estima con un % configurable de la tarjeta y se marca como "estimado".

## Alertas
- Días antes de la fecha de pago
- Consumo mayor a un % del cupo (configurable, por ejemplo 30 %)
- Pago atrasado

Ver [[Alertas]] y [[Plan para salir de deudas]].
