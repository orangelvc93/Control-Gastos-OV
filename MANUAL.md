# Manual de Uso: Control de Gastos

## Inicio de sesion

El acceso usa Supabase Auth (email y contraseña). Los usuarios se crean desde el panel de Supabase: **Authentication → Users**, y una contraseña olvidada también se cambia desde ese panel.

## Ejecutar la aplicacion

1. Copia `.env.example` a `.env` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
2. Desde la carpeta del proyecto:

```powershell
npm install
npm run dev
```

La web queda en `http://localhost:5174/`.

## Base de datos

Los datos viven en Supabase (PostgreSQL). El esquema completo está en `supabase/schema.sql`; cada tabla tiene RLS para que cada usuario solo vea sus datos.

Un workflow de GitHub (`.github/workflows/supabase-keepalive.yml`) llama a diario a la base para que el plan gratuito no la pause por inactividad.

## Años

- Selecciona el año desde el selector de la cabecera.
- Presiona `Nuevo año` para crear un año nuevo.
- Cambiar de año cambia toda la información visible de la app.

## Historial de cambios

Cada guardado agrega un registro (fecha, acción y detalle) a la tabla `journal`. Sirve para revisar eliminaciones, ediciones y registros agregados.

## Dashboard

El Dashboard muestra:

- Pagos del mes seleccionado.
- Ganancias del mes seleccionado.
- Balance mensual.
- Grafico compacto anual.
- Resumen de cuotas y deuda restante.

Uso:

- Cambia el mes desde el selector superior.
- Revisa el resumen de deudas activas debajo.

## Movimientos

Permite gestionar pagos y ganancias.

Pagos recurrentes:

- La fecha inicia con la fecha actual.
- Puedes cambiarla antes de guardar.
- `Estado` es un selector con `Pendiente` y `Pagado`.
- `Concepto` tiene autocompletado basado en conceptos usados antes.
- Todos los campos son obligatorios.

Ganancias:

- La fecha inicia con la fecha actual.
- `Concepto` tiene autocompletado basado en conceptos usados antes.
- Todos los campos son obligatorios.

Acciones disponibles:

- Agregar.
- Editar.
- Eliminar.

## Ahorros

Cada cuenta de ahorro tiene su propia tabla.

Puedes:

- Crear cuentas nuevas.
- Cambiar el nombre de una cuenta.
- Eliminar una cuenta.
- Agregar un nuevo movimiento con mes, interes ganado y aporte opcional.
- Editar registros existentes.
- Eliminar registros equivocados.

Debajo de cada tabla se muestra:

- `Ultimo saldo final`: saldo final del ultimo registro de esa cuenta.

El siguiente movimiento toma automaticamente ese ultimo saldo final como saldo inicial.

## Deudas y cuotas

Permite administrar prestamos, compras en cuotas y compromisos.

Puedes:

- Crear nuevas deudas.
- Editar cuota mensual y cuotas totales.
- Marcar cuantas cuotas has pagado.
- Ver cuotas faltantes.
- Ver deuda restante calculada automaticamente.
- Archivar deudas para que ya no aparezcan en la tabla activa.
- Eliminar deudas.

Formula usada:

```text
Deuda restante = (Cuotas totales - Cuotas pagadas) * Cuota mensual
```

## Gastos vs Sueldo

Permite administrar presupuesto fijo.

Puedes crear, editar y eliminar:

- Gastos fijos.
- Ganancias fijas.

Tambien muestra:

- Total con interes.
- Total sin interes.
- Distribucion sugerida segun porcentajes.

## Ayuda Guiada

La app integra `driver.js`.

Para iniciar el recorrido:

1. Inicia sesion.
2. Presiona el boton `Ayuda` en la cabecera.
3. Sigue los pasos del tour.

El recorrido explica:

- Centro de control.
- Menu principal.
- Area de trabajo.
- Boton de ayuda.

