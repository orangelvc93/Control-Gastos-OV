---
tags: [reglas]
---
# Reglas generales

- **Cálculos exactos.** Mostrar montos con 2 decimales y redondear **solo al final**. En código: trabajar en centavos enteros o con una librería decimal, nunca con sumas de `float` sueltas.
- **Nada se borra definitivamente sin confirmación.**
- **Cambios en recurrentes** preguntan si aplican a *"solo este"* o a *"este y los siguientes"* (ver [[Movimientos recurrentes]]).
- **Interfaz simple y clara**, sin jerga financiera innecesaria.
- **Cada cálculo se explica**: cuando la app muestra un número calculado, indica de dónde sale (por ejemplo, "Saldo = inicial 500 + ingresos 1.200 − gastos 900").
- **Saldos nunca editables a mano**: se derivan de los movimientos (ver [[Cuentas]]).
- **Valores tributarios configurables**, nunca fijos en el código (ver [[Configuración por año (SRI)]]).
- **Antes de modificar código**: revisar cómo está la app hoy ([[Estado actual de la app]]), decir qué existe, qué falta y en qué orden implementarlo ([[Hoja de ruta]]). Si algo es ambiguo, preguntar antes de asumir ([[Preguntas abiertas]]).
