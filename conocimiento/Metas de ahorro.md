---
tags: [modulo]
modulo: 3
---
# Metas de ahorro

Ejemplos: fondo de emergencia, viaje, auto.

## Implementado (fase 4, 2026-10-22)
- Pantalla **Más → Metas de ahorro** (`/metas`), tabla `goals`.
- Lo ahorrado = saldo de la cuenta asociada; sin cuenta, lo anota el usuario.
- Avance %, aporte mensual necesario (con interés compuesto si la cuenta tiene tasa), estado: a tiempo / un poco atrás / atrasada (más de 10 % del objetivo por debajo de lo esperado en línea recta desde que se creó) / pasó la fecha.
- **"Ahorrar esto cada mes"**: abre un frecuente de transferencia hacia la cuenta de la meta, prellenado.
- Aviso `meta-atrasada` una vez por mes.

## Datos
| Campo | Notas |
|---|---|
| Nombre | |
| Monto objetivo | |
| Fecha límite | |
| Cuenta asociada | ver [[Cuentas]] |

## Cálculos
- **Ahorro mensual necesario** para llegar a la meta:

$$\text{aporte mensual} = \frac{\text{objetivo} - \text{ahorrado}}{\text{meses hasta la fecha límite}}$$

  (si la cuenta genera interés, se puede usar la fórmula con interés compuesto de [[Fórmulas]]).
- **Avance**: ahorrado ÷ objetivo, en %.

Parte de [[Plan de ahorro]].
