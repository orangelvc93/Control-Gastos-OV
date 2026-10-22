---
tags: [desarrollo]
---
# Preguntas abiertas

Dudas a resolver antes de implementar. Al responder una, anotar la decisión aquí y en la nota del módulo.

> [!success] Las 15 preguntas se respondieron el 2026-10-20. Las decisiones ya están reflejadas en las notas de cada módulo.

## Modelo de datos
1. **¿Se mantiene la separación por años?** La especificación implica un libro continuo (los saldos se arrastran). Propuesta: libro continuo con filtros por año/mes, y migrar los datos actuales.
   - ✅ **Decisión (2026-10-20): libro continuo.** Un solo historial de movimientos con fechas; los saldos se arrastran solos y años/meses son solo filtros para ver y exportar.
2. **¿Se migran los datos existentes** (pagos, ingresos, deudas, ahorros) al nuevo modelo o se empieza de cero?
   - 🔄 **Decisión final: empezar de cero** con el saldo real de cada cuenta al 2026-10-20 (ver [[Esquema de datos (fase 1)]]). Decisión inicial, descartada: migrar todo. Pagos e ingresos → movimientos con fecha; cuentas de ahorro → cuentas con su historial; deudas → créditos. Antes de migrar se saca un respaldo en Excel.
3. **Multimoneda**: USD por defecto, pero ¿habrá cuentas en otra moneda? Si sí, ¿cómo se convierte para el patrimonio?
   - ✅ **Decisión: solo USD.** El campo moneda se guarda (por defecto USD) pero no hay conversiones.

## Cuentas e intereses
4. Si un interés **no se capitaliza**, ¿se registra igual como ingreso pero en otra cuenta, o solo se muestra como estimado?
   - ✅ **Decisión: va a otra cuenta.** Cada cuenta con interés sin capitalizar define una cuenta destino, donde el interés se registra como ingreso "Rendimientos financieros".
5. ¿El interés que se registra es el **bruto** (y la retención aparte) o el **neto**?
   - ✅ **Decisión: solo neto** (lo que llega a la cuenta). Para la [[Exportación para el SRI]] la app reconstruye el bruto y la retención con el % configurado: bruto = neto ÷ (1 − %retención); retención = bruto − neto.
6. ¿Los intereses se calculan sobre el **saldo de fin de mes**, el **promedio** o el **saldo diario**?
   - ✅ **Decisión: saldo diario.** Interés del día = saldo del día × tasa diaria. Tasa diaria nominal = tasa anual ÷ base de días; efectiva = (1 + tasa anual)^(1/base) − 1. Base de días configurable por cuenta (360 o 365), porque cada banco usa una.

## Recurrentes y alertas
7. ¿Los recurrentes se generan **al abrir la app** o con una tarea programada en el servidor (por ejemplo, `pg_cron` en Supabase)?
   - ✅ **Decisión: en el servidor.** Tarea diaria con `pg_cron` en Supabase que crea los movimientos vencidos (idempotente: nunca duplica). También cuenta como actividad para que Supabase no se pause.
8. ¿Por qué canal llegan las alertas: dentro de la app, correo o notificación push?
   - ✅ **Decisión: avisos dentro de la app + notificación push + Telegram.** Todo aviso se guarda primero en la app (historial consultable) y desde ahí se envía por push y Telegram. Push requiere convertir la app en PWA (service worker + Web Push); Telegram, un bot propio cuyo token va como secreto en Supabase. Las alertas se generan en el servidor (misma tarea diaria de la pregunta 7).

## Tarjetas y créditos
9. En diferidos con intereses, ¿la tasa es la de la tarjeta o una tasa propia de cada consumo?
   - ✅ **Decisión: siempre la tasa de la tarjeta.**
10. El interés por pago parcial, ¿se calcula mensual (saldo × tasa/12) o diario como lo hacen los bancos?
   - ✅ **Decisión: diario.** Saldo pendiente × tasa diaria por cada día hasta el siguiente corte (misma base de días configurable que en la pregunta 6).
11. ¿Cómo se define el "pago mínimo" de cada tarjeta (% del saldo, monto fijo, dato del estado de cuenta)?
   - ✅ **Decisión: se ingresa del estado de cuenta** cada mes. Si falta, se estima con un % configurable por tarjeta (marcado como "estimado").
12. Créditos con tasa **efectiva** en lugar de nominal: ¿se necesita también para créditos?
   - ✅ **Decisión: sí, elegible por crédito.** Nominal: i = tasa ÷ 12. Efectiva: i = (1 + TEA)^(1/12) − 1.

## Archivos y exportación
13. Las facturas adjuntas irían a Supabase Storage (plan gratuito: 1 GB). ¿Es suficiente o se comprime / limita el tamaño?
   - ✅ **Decisión: sin adjuntos.** No se guardan fotos, PDF ni XML; solo los datos de la factura.
   - ✅ **Decisión: comprimir.** Fotos reducidas a ~200–300 KB en el navegador antes de subir; PDF con límite de 2 MB. Bucket privado con RLS por usuario.
14. Para el SRI, ¿necesitas ingresar también facturas electrónicas por clave de acceso, o solo los datos manuales?
   - ✅ **Decisión: manual + lectura del XML** de la factura electrónica. Al elegir el XML se rellenan RUC, número, fecha, base imponible e IVA; el XML no se guarda (ver pregunta 13).

## Registro de usuarios
15. Con el registro público (tarjeta G36), ¿la app será solo para ti y tu familia o abierta a cualquiera? Afecta seguridad, límites y la tarjeta C18.
   - ✅ **Decisión: solo invitados.** El registro público queda desactivado en Supabase (C18 se mantiene); el dueño invita por email (`inviteUserByEmail` desde una función del servidor) y el invitado completa sus datos en la pantalla de registro (G36).
