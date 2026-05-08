# Design System: Control de Gastos

Este documento define los estilos exclusivos de esta app. El lenguaje actual es dark premium, compacto, con naranja como color primario y morado como acento secundario.

## Concepto

La app debe sentirse como una herramienta financiera profesional: densa, rapida de leer y con jerarquia clara.

Principios:

- Fondo dark para reducir ruido visual.
- Naranja para acciones, estados importantes y valores destacados.
- Morado para profundidad, navegacion activa y detalles premium.
- Componentes compactos para mostrar mas informacion sin sentirse saturado.
- Tablas en flujo vertical; no colocar tablas una al lado de otra.

## Tokens

Los tokens viven en `src/styles.css` dentro de `:root`.

Colores principales:

- `--bg`: fondo principal oscuro.
- `--bg-soft`: fondo oscuro secundario.
- `--panel`: superficie de tarjeta.
- `--panel-2`: superficie elevada con tono morado.
- `--panel-3`: superficie secundaria.
- `--line`: borde sutil.
- `--text`: texto principal.
- `--muted`: texto secundario.
- `--faint`: texto de baja jerarquia.
- `--orange`: color primario para acciones.
- `--orange-2`: naranja claro para valores destacados.
- `--purple`: color secundario premium.
- `--purple-2`: morado claro para detalles.
- `--green`: ingresos y balances positivos.
- `--red`: pagos, deuda y balances negativos.

## Layout

Estructura base:

- `.finance-shell`: contenedor principal de una columna.
- `.command-center`: cabecera compacta con estado de sincronizacion.
- `.app-nav`: menu horizontal sticky y responsive.
- `.workspace`: contenedor de la seccion activa.
- `.stack`: separacion vertical entre bloques.
- `.grid-layout`: debe mantenerse en una columna para evitar tablas lado a lado.

Reglas de layout:

- Las tablas deben aparecer debajo de sus formularios o titulos.
- No usar dos tablas en paralelo.
- Los formularios pueden usar varias columnas en escritorio, pero se apilan en movil.
- La navegacion siempre es horizontal; en pantallas pequenas hace scroll lateral.

## Componentes

### Command Center

Clase: `.command-center`

Uso: cabecera principal de la app.

Reglas:

- Debe mostrar nombre, descripcion corta y estado de sincronizacion.
- Usa fondo dark con brillo naranja y morado.
- No colocar tablas dentro de este bloque.

### Navegacion

Clase: `.app-nav`

Uso: cambio entre Dashboard, Movimientos, Ahorros, Deudas y Gastos vs Sueldo.

Reglas:

- Cada boton debe tener un `strong` con el nombre y un `span` con descripcion corta.
- Estado activo: gradiente morado/naranja.
- En responsive mantiene scroll horizontal.

### Tarjetas

Clase base: `.ledger-card`

Variantes:

- `.featured-card`: tarjeta principal con glow naranja.
- `.debt-brief`: tarjeta de deudas con acento rojo.
- `.form-card`: tarjeta para captura de movimientos.
- `.savings-card`: tarjeta con linea superior naranja/morado.

Reglas:

- Toda informacion financiera vive dentro de una tarjeta.
- Tarjetas compactas: padding corto, radios medianos, sombras controladas.

### KPIs

Clase: `.kpi`

Tonos:

- `.success`: valores positivos o ingresos.
- `.danger`: pagos, deuda o deficit.
- Sin tono: valor neutro con naranja claro.

### Tablas

Clases: `.table-wrap`, `table`, `th`, `td`

Reglas:

- Toda tabla debe estar envuelta en `.table-wrap`.
- Las tablas usan overflow horizontal en pantallas pequenas.
- Encabezados con tinte morado.
- Celdas compactas para lectura rapida.

### Formularios

Clase: `.movement-form`

Reglas:

- Compacto por defecto.
- Hasta 6 columnas en escritorio cuando aplica.
- Dos columnas en tablet.
- Una columna en movil.
- Botones primarios siempre naranja.

## Persistencia Visual

La app muestra el estado de sincronizacion en `.command-actions span`.

Estados recomendados:

- `Conectando con JSON...`
- `Sincronizado con db/years/YYYY.json`
- `Pago guardado en JSON`
- `Ganancia guardada en JSON`
- `Movimiento eliminado del JSON`
- `JSON restaurado con datos iniciales`

## Journal

Cada guardado agrega un registro a la propiedad `journal` del archivo anual activo en `db/years/YYYY.json`.

Campos:

- `Fecha`
- `Accion`
- `Detalle`

## Restricciones

- No agregar frameworks CSS para esta app.
- No usar estilos globales fuera de `src/styles.css`.
- No poner tablas una al lado de otra.
- No cambiar los nombres de tokens sin actualizar este documento.
