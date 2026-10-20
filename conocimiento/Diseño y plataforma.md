---
tags: [vision, diseño]
---
# Diseño y plataforma

Requisitos de la interfaz (decisión del 2026-10-20). Se puede cambiar la estructura visual actual si hace falta.

## Principios
- **Práctica y simple**: las tareas frecuentes (registrar un gasto, ver cuánto tengo) deben hacerse en 1–2 toques.
- **Funciona en todos los dispositivos**: celular, tablet y computadora, diseñando **primero para el celular**.
- **Web app instalable (PWA)**: se puede añadir a la pantalla de inicio, abre a pantalla completa como una app y es la base de las notificaciones push ([[Alertas]]).
- Sin jerga financiera innecesaria; cada número calculado explica de dónde sale ([[Reglas generales]]).

## Estructura propuesta
| Elemento | Celular | Computadora |
|---|---|---|
| Navegación | barra inferior con 4–5 secciones | menú lateral |
| Acción principal | botón flotante "+" para registrar un movimiento | botón "+" en la cabecera |
| Listas y tablas | tarjetas apiladas | tablas con filtros |
| Formularios | hoja que sube desde abajo | modal centrado |

Secciones sugeridas: **Inicio** (resumen y avisos) · **Movimientos** · **Cuentas** · **Deudas** · **Más** (ahorro, metas, compras, reportes, SRI, ajustes).

## PWA
- `manifest.webmanifest` con nombre, iconos y colores.
- Service worker: carga rápida y pantalla básica sin conexión.
- Notificaciones push (fase 2).

## Accesibilidad y estilo
- Contraste AA, foco visible, campos con etiqueta, modales accesibles (tarjetas E29–E32 en Trello).
- Paleta y variables de diseño únicas (G39, D25).

Ver [[Hoja de ruta]].
