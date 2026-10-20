---
tags: [modulo, deudas]
modulo: 4B
---
# Tarjetas de crédito

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
