---
tags: [modulo]
modulo: 1
---
# Cuentas

## Tipos
Corriente · Ahorro · Efectivo · Tarjeta de crédito · Inversión · Póliza

## Datos de cada cuenta
| Campo | Notas |
|---|---|
| Nombre | obligatorio |
| Banco o institución | |
| Tipo | uno de los tipos de arriba |
| Moneda | USD (única moneda; sin conversiones) |
| Saldo inicial | |
| Tasa de interés anual (%) | solo ahorro o inversión; ver [[Intereses]] |

Se pueden **crear, editar y eliminar** (eliminar con confirmación, ver [[Reglas generales]]).

Las tarjetas de crédito tienen datos y reglas propias: ver [[Tarjetas de crédito]].

## Libro continuo
Todos los movimientos forman **un solo historial con fechas**; los saldos se arrastran solos de un mes y un año al siguiente. Años y meses son solo filtros para ver y exportar.

## Saldo
El saldo **siempre se calcula**, nunca se edita a mano, para que todo cuadre:

$$\text{saldo} = \text{saldo inicial} + \text{ingresos} - \text{gastos} \pm \text{transferencias} + \text{intereses}$$

## Transferencias
- Mueven dinero entre dos cuentas propias.
- **No cuentan como gasto ni como ingreso.**
- El pago de una tarjeta o de un crédito es una transferencia (ver [[Tarjetas de crédito]], [[Créditos y préstamos]]).

## Resumen general
- **Patrimonio total** (neto) = lo que tengo − lo que debo (las deudas restan; ver [[Plan para salir de deudas]]).
- **Total en ahorros.**
- **Dinero disponible.**
