---
tags: [referencia]
---
# Alertas

**Canales:**
1. **Avisos dentro de la app**: fuente principal. Cada alerta se guarda en una tabla de avisos y se ve en una campana con contador de no leídos y un historial. Se puede marcar como leída, ir al detalle (la tarjeta, el crédito o la categoría) y filtrar por tipo.
2. **Notificación push** (la app instalada como PWA).
3. **Bot de Telegram.**

Push y Telegram son copias del aviso guardado: si alguno no llega, el aviso sigue disponible en la app. Las alertas se generan en el servidor, en la misma tarea diaria que crea los [[Movimientos recurrentes]], y nunca se duplican (una por evento).

| Alerta | Cuándo | Módulo |
|---|---|---|
| Próximos recurrentes | movimientos fijos que vienen | [[Movimientos recurrentes]] |
| Presupuesto de categoría superado | gasto de la categoría > presupuesto | [[Plan de ahorro]] |
| Gastos > ingresos del mes | | [[Plan de ahorro]] |
| Pago de tarjeta próximo | N días antes de la fecha límite | [[Tarjetas de crédito]] |
| Uso alto del cupo | consumo > % configurable del cupo (p. ej. 30 %) | [[Tarjetas de crédito]] |
| Pago atrasado | pasó la fecha límite sin pago completo | [[Tarjetas de crédito]] |
| Pago mínimo | pago < total: costo en intereses | [[Tarjetas de crédito]] |
| Endeudamiento alto | deudas > 30–35 % del ingreso | [[Plan para salir de deudas]] |
