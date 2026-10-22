---
tags: [referencia, sri]
---
# Configuración por año (SRI)

Valores que **cambian cada año** y por tanto se guardan como configuración editable (por año fiscal), nunca fijos en el código:

| Parámetro | Usado en |
|---|---|
| Categorías de gastos personales deducibles | [[Facturas y gastos deducibles]] |
| Límites de deducción (globales y por categoría) | [[Exportación para el SRI]] |
| Porcentajes de deducción / rebaja | [[Exportación para el SRI]] |
| % de retención en la fuente sobre intereses | [[Intereses]] |
| Tipos de ingreso para la declaración | [[Exportación para el SRI]] |

> [!warning] Antes de cada declaración hay que verificar estos valores con la normativa vigente del SRI. La app debe mostrar esta advertencia en la exportación.

## En la app (fase 5)

Tabla `tax_years` (uno por usuario y año), editable en **Más → Impuestos → Valores del SRI**: fracción básica, canasta familiar básica, % de rebaja (18 %), cargas familiares, enfermedad catastrófica, canastas por cargas (0→7, 1→9, 2→11, 3→14, 4→17, 5 o más→20; catastrófica→20) y % de retención en intereses (2 %; cada cuenta puede tener el suyo).

Rebaja estimada = % de rebaja × menor valor entre los gastos personales del año y (canastas × canasta básica).

Valores de partida para 2026 (verificar): fracción básica $12.208 y canasta básica de enero $821,80. Un año sin valores guardados parte del último año guardado.

