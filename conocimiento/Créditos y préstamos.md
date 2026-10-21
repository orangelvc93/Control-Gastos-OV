---
tags: [modulo, deudas]
modulo: 4B
---
# Créditos y préstamos

Tipos: bancario, de consumo, vehicular, hipotecario o préstamo personal (incluso entre familiares), con o sin intereses.

## Implementado (fase 3, 2026-10-20)
- `supabase/fase3b_creditos.sql` + `src/shared/lib/loans.js`. Cada crédito es una cuenta de tipo **Crédito o préstamo** (saldo negativo = deuda, resta en el patrimonio) con su ficha en `loans`.
- **Crear** (Gestión → Crédito o préstamo):
  - *Lo recibo ahora*: el dinero entra a una cuenta como **transferencia desde el crédito** (no es ingreso).
  - *Ya lo estoy pagando*: la cuenta empieza hoy con lo que debes y las cuotas ya pagadas.
  - La cuota se calcula (francés o alemán, tasa nominal o efectiva) y se puede reemplazar por la que cobra el banco. Vista previa: cuotas, total a pagar, intereses y seguros.
- **Cuotas automáticas** el día de pago (tarea diaria): interés = deuda real antes de la cuota × tasa mensual → gasto en *Intereses y comisiones*; capital → transferencia hacia el crédito; seguros/cargos → gasto. Confirmadas si el banco debita solo; si no, quedan en "Por confirmar".
- **Detalle**: Resumen (próxima cuota con su desglose, avance, intereses pagados y por pagar, total que falta), Tabla de pagos (pagadas + proyección), Abono extra (compara reducir plazo vs. reducir cuota y lo registra) y Movimientos.
- **Avisos**: próxima cuota N días antes y cuota registrada.

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
