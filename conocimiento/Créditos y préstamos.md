---
tags: [modulo, deudas]
modulo: 4B
---
# Créditos y préstamos

Tipos: bancario, de consumo, vehicular, hipotecario o préstamo personal (incluso entre familiares), con o sin intereses.

## Datos
| Campo | Notas |
|---|---|
| Monto | |
| Tasa anual | 0 % si no tiene interés |
| Tipo de tasa | nominal o efectiva anual (TEA) |
| Plazo | meses |
| Fecha de inicio | |
| Día de pago | |
| Cuenta de pago | ver [[Cuentas]] |
| Seguros / cargos fijos | opcionales |
| Sistema | francés (por defecto) o alemán |

## Cálculo de cuota
- **Sin intereses**: cuota = monto ÷ plazo.
- **Sistema francés (cuota fija)**: cuota = P × i ÷ (1 − (1 + i)^−n).
- **Sistema alemán**: capital fijo, cuota decreciente.

Detalle en [[Fórmulas#Créditos]].

## Tabla de amortización
Columnas: n.º de cuota · fecha · cuota · interés · capital · saldo pendiente.

## Integración
- La cuota se crea automáticamente como **gasto recurrente** en la cuenta asociada ([[Movimientos recurrentes]]), separando el **interés (gasto)** del **capital (reducción de deuda)**.
- Muestra el **total que terminaré pagando** y cuánto de eso son **intereses**.

## Simulador de abonos extra
Ante un pago adicional muestra cuántos meses y cuánto interés me ahorro, y me deja elegir entre:
- **reducir el plazo**, o
- **reducir la cuota**.

Ver [[Plan para salir de deudas]].
