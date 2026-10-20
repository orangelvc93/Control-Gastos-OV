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
| Archivo adjunto | foto (comprimida a ~200–300 KB), PDF (máx. 2 MB) o XML |
| RUC del proveedor | |
| Número de factura | |
| Base imponible | |
| IVA | |

## Cómo se ingresan
- **A mano**, en un formulario.
- **Subiendo el XML** de la factura electrónica: la app rellena RUC, número, fecha, base imponible e IVA, y guarda el XML como adjunto.

Los archivos van a un bucket privado de Supabase Storage (1 GB gratis), accesible solo por su dueño.

Estos datos alimentan la [[Exportación para el SRI]].
