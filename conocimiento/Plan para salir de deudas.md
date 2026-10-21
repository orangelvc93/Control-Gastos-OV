---
tags: [modulo, deudas]
modulo: 4B
---
# Plan para salir de deudas

## Implementado (fase 3, 2026-10-20)
- Pantalla **Más → Plan para salir de deudas** (`/deudas`, también desde Inicio → Deudas). Cálculos en `src/shared/lib/debts.js`; aviso en `supabase/fase3c_deudas.sql`.
- Indicadores: deuda total, pago mensual (cuotas de créditos con seguros + mínimo estimado de tarjetas, al menos $10) y **% de ingresos**: sano hasta 30 %, con cuidado 30–35 %, alto > 35 %.
- Ingreso mensual: el que anotas (se guarda en `user_settings.monthly_income`) o el promedio de ingresos confirmados de los últimos 3 meses completos.
- Simulación mes a mes con dinero extra: interés del mes → mínimos → el extra (más los pagos de las deudas ya terminadas) va a la prioritaria. **Avalancha** (mayor tasa) vs. **bola de nieve** (menor saldo) vs. solo mínimos: tiempo, fecha, intereses, orden en que se termina cada deuda y gráfica del saldo total (con vista de tabla).
- **Antes de endeudarte**: cuota de un crédito/diferido nuevo y cómo cambia el % de endeudamiento.
- Aviso mensual `deuda-alta` si las cuotas superan el 35 % del ingreso.
- Limitación: las tarjetas se simulan como saldo revolvente con su mínimo (no separa diferidos); sin tasa anotada se tratan sin intereses.

## Vista consolidada
Todas las deudas ([[Tarjetas de crédito]] + [[Créditos y préstamos]]): saldo, tasa, cuota mensual y fecha estimada de fin de pago de cada una.

## Indicadores
- Deuda total
- Pago mensual total
- **% de ingresos que se va en deudas** = pago mensual total ÷ ingreso mensual. **Alerta si supera 30–35 %** ([[Alertas]]).

## Plan con dinero extra mensual
| Método | Orden de pago | Ventaja |
|---|---|---|
| **Avalancha** | primero la deuda con mayor tasa | ahorra más intereses |
| **Bola de nieve** | primero la deuda más pequeña | motiva más rápido |

La app **compara los dos**: fecha en que quedo libre de deudas e intereses totales de cada uno.

## Simulador de nuevo crédito o diferido
Antes de endeudarme, muestra cómo cambia mi presupuesto mensual ([[Plan de ahorro]]) y si sigo dentro de un nivel de endeudamiento sano.

## Patrimonio y declaración
- Las deudas **restan** en el patrimonio: patrimonio neto = lo que tengo − lo que debo ([[Cuentas#Resumen general]]).
- La exportación anual incluye el saldo de deudas al 31 de diciembre y los intereses pagados ([[Exportación para el SRI]]).
