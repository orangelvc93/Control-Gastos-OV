---
tags: [modulo]
modulo: 4
---
# Intereses

Aplica a cada [[Cuentas|cuenta]] con tasa anual (ahorro, inversión, póliza).

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
