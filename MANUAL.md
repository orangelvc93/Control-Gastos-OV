# Manual de Uso: Control de Gastos

## Inicio de sesion

La aplicacion abre con una pantalla de acceso.

Credenciales iniciales:

- Usuario: `orangelvc93`
- Contrasena: `123456`

Para cambiar las credenciales edita:

`public/auth-config.json`

Ejemplo:

```json
{
  "username": "nuevo_usuario",
  "password": "nueva_contrasena"
}
```

Nota: este login protege el acceso casual al frontend local. No reemplaza una autenticacion de servidor para publicar la app en internet.

## Ejecutar la aplicacion

Desde la carpeta del proyecto:

```powershell
npm run dev
```

Servicios:

- Web: `http://localhost:5173/`
- API JSON: `http://localhost:3002/api/data`

## Base de datos JSON

El archivo principal esta en:

`db/years/<año>.json`

Cada cambio realizado desde la web se guarda automaticamente en el JSON.

## Años

La app permite trabajar con varios años.

Uso:

- Selecciona el año desde el selector de la cabecera.
- Presiona `Nuevo año` para crear un año nuevo.
- Al crear un año se genera un JSON nuevo en blanco.
- Cada año se guarda separado en `db/years/YYYY.json`.

Ejemplo:

```text
db/years/2026.json
db/years/2027.json
```

Cambiar de año cambia toda la información visible de la app.

Secciones principales:

- `months`: meses disponibles.
- `payments`: pagos recurrentes y variables.
- `income`: ingresos.
- `debts`: prestamos y cuotas.
- `savings`: cuentas y movimientos de ahorro.
- `fixedBudget.expenses`: gastos presupuestados.
- `fixedBudget.income`: ingresos presupuestados.
- `fixedBudget.distribution`: porcentajes sugeridos.
- `journal`: historial de cambios.

## Journal

La propiedad `journal` registra los cambios hechos desde la app.

Campos:

- `Fecha`: momento del cambio.
- `Accion`: operacion realizada.
- `Detalle`: informacion asociada al cambio.

Sirve para revisar eliminaciones, ediciones y registros agregados.

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

## Plantilla en blanco

La carpeta `Control de Gastos - Plantilla` contiene una copia limpia del proyecto.

Incluye:

- Mismo codigo de la app.
- Mismo login configurable.
- Mismo recorrido de ayuda.
- JSON en blanco en `db/data.json`.

Para probarla:

```powershell
cd "C:\Users\orangel.valdespino\Desktop\Control de Gastos - Plantilla"
npm install
npm run dev
```

No ejecutes al mismo tiempo la app original y la plantilla porque usan los mismos puertos locales.
