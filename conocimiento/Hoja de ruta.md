---
tags: [desarrollo]
---
# Hoja de ruta (propuesta)

Orden pensado para que cada fase se apoye en la anterior. Pendiente de validar con [[Preguntas abiertas]].

## Fase 0 · Base sólida (Trello: bloques B, C)
- Guardado seguro (sin borrar y reinsertar todo), cola de guardados, errores visibles.
- Montos en centavos enteros / decimal exacto ([[Reglas generales]]).
- Tests de [[Fórmulas]].

## Fase 1 · Núcleo contable
- **Nueva estructura visual** ([[Diseño y plataforma]]): diseño primero para el celular, barra inferior / menú lateral, botón "+" y web app instalable (PWA). Las pantallas nuevas nacen ya con este diseño.
- [[Cuentas]] con saldo calculado y **transferencias**.
- [[Movimientos]] ligados a cuenta, con categorías editables.
- Resumen: patrimonio, ahorros, disponible.
- Libro continuo (sin separación por años).
- Respaldo en Excel y **migración de todos los datos actuales**.

## Fase 2 · Automatización ✅ (2026-10-20)
- Tarea diaria en el servidor (`pg_cron`).
- [[Movimientos recurrentes]] (frecuencias, "solo este / este y los siguientes").
- [[Alertas]]: primero los avisos dentro de la app (campana e historial); después la app instalable (PWA) con notificaciones push y el bot de Telegram.

## Fase 3 · Deudas
- [[Créditos y préstamos]] con tabla de amortización y simulador de abonos.
- [[Tarjetas de crédito]] con consumos, diferidos y estado de cuenta. ✅ (2026-10-20)
- [[Plan para salir de deudas]] (avalancha vs. bola de nieve).

## Fase 4 · Ahorro e intereses
- [[Intereses]] con tipo de tasa, capitalización, retención y proyección.
- [[Plan de ahorro]] 50/30/20 editable, presupuestos por categoría.
- [[Metas de ahorro]] y fondo de emergencia.

## Fase 5 · Impuestos y reportes
- [[Facturas y gastos deducibles]] con adjuntos.
- [[Configuración por año (SRI)]].
- [[Reportes y exportación]] (Excel/CSV/PDF) y [[Exportación para el SRI]].

## Fase 6 · Extras
- [[Lista de compras]].
