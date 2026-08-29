# Motor de legalidades

El motor es una herramienta de control según reglas configuradas; sus resultados no constituyen certificación jurídica. La fecha de la planificación resuelve la vigencia y cada validación conserva un snapshot y `ruleSetVersion`.

## Reglas iniciales configuradas

| Código | Categoría | Parámetro inicial | Vigencia | Severidad | Bloqueante | Datos requeridos |
|---|---|---:|---|---|---|---|
| `MAX_WEEKLY_ORDINARY_HOURS` | LABOR_LEGAL | 2520 minutos | 26-04-2026 | ERROR | Sí | Turnos y colaciones semanales |
| `MAX_DAILY_ORDINARY_HOURS` | LABOR_LEGAL | 600 minutos | 26-04-2026 | ERROR | Sí | Turnos y colaciones del día |
| `MIN_REST_BETWEEN_WORK_DAYS` | LABOR_LEGAL | 720 minutos | 26-04-2026 | ERROR | Sí | Fin anterior e inicio siguiente, incluido histórico |
| `MAX_CONSECUTIVE_WORK_DAYS` | HISTORICAL | 6 días | 26-04-2026 | ERROR | Sí | Semana e histórico validado |
| `BREAK_REQUIRED` | LABOR_LEGAL | JSON: umbral 300, mínimo 30 minutos | 26-04-2026 | WARNING | No | Presencia y colación |
| `MAX_WORK_BEFORE_BREAK_MINUTES` | COMPANY_RULE | 300 minutos | 26-04-2026 | ERROR | Sí | Inicio de jornada e inicio de colación |

Los valores son configuración inicial solicitada, no constantes del código. La referencia normativa opcional se almacena en `source_reference` y debe completarse durante la aprobación de reglas.

## Resultados derivados

`CONTRACT_WEEKLY_HOURS`, `EMPLOYMENT_START_DATE`, `EMPLOYMENT_END_DATE`, `EMPLOYEE_ACTIVE`, `EMPLOYEE_NOT_FOUND`, `INCOMPLETE_CONTRACT`, `SPLIT_SHIFT_ALLOWED` y `QF_COVERAGE` dependen de datos maestros o contractuales. No se inventan datos ausentes: se informa falta de antecedentes o se bloquea la identificación, según corresponda.

## Precedencia

`EMPLOYEE → EMPLOYEE_GROUP → WORK_UNIT → LABOR_REGIME → CONTRACT_TYPE → STORE → ORGANIZATION → GLOBAL`. Dentro del mismo alcance prevalece la versión vigente más reciente. Una regla usada en un snapshot no puede editarse silenciosamente: debe crearse una versión nueva.

## Segunda etapa modelada

Existen estructuras para festivos, domingos adicionales, canjes y descansos compensatorios. Su evaluación queda deshabilitada hasta contar con reglas y datos aprobados; el motor no presume su aplicabilidad.
