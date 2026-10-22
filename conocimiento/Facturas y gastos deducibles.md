---
tags: [modulo, sri]
modulo: 2
---
# Facturas y gastos deducibles

## Gasto deducible
Cada gasto puede marcarse como **deducible** y asignarse a una categoría del SRI:

- Vivienda
- Salud
- Educación (incluye arte y cultura)
- Alimentación
- Vestimenta
- Turismo

> [!warning] Las categorías, límites y porcentajes de deducción los define el SRI y pueden cambiar cada año. Van en [[Configuración por año (SRI)]], no fijos en el código.

## Datos de la factura
| Campo | Notas |
|---|---|
| RUC del proveedor | |
| Número de factura | |
| Base imponible | |
| IVA | |

> [!note] ✅ Decisión (2026-10-22): **sin adjuntos**. No se guardan fotos, PDF ni XML de las facturas, para no ocupar espacio. Solo se guardan los datos de la tabla.

## Cómo se ingresan
- **A mano**, en un formulario.
- **Leyendo el XML** de la factura electrónica: la app lo lee en el navegador y rellena RUC, número, fecha, base imponible e IVA. El XML **no se guarda**; solo los datos.

Estos datos alimentan la [[Exportación para el SRI]].

## Cómo funciona en la app (fase 5)

- Al elegir una categoría con **categoría del SRI**, el gasto se marca **deducible** (casilla en el formulario, se puede quitar).
- Si es deducible aparece la sección **Factura**: RUC del proveedor (10 a 13 dígitos), número, base imponible e IVA, y el botón **Leer XML de la factura electrónica** (llena también monto, fecha y proveedor si están vacíos).
- **Más → Impuestos**: gastos personales del año por categoría frente al tope en canastas y la rebaja estimada, **facturas por completar** (sin RUC o número), ingresos del año por tipo y deudas al 31/12.
- Aviso `factura-incompleta` los días 1 a 7: gastos deducibles del mes anterior sin RUC o número.
- Columnas: `transactions.invoice_ruc`, `invoice_number`, `invoice_base`, `invoice_iva` (y el `deductible` que ya existía).

