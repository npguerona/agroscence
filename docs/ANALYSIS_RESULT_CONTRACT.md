# Contrato De Resultado De Análisis

El endpoint `POST /api/v2/analysis/zone` debe devolver un objeto estable en `data.analysis`.

Versión actual: `analysis-result.v1`

## Objetivo

El frontend no debe recalcular decisiones críticas. Los agentes y el orquestador producen el resultado final, y el frontend solo lo presenta.

## Secciones Principales

- `location`: zona analizada, coordenadas, altitud y área.
- `api_status`: estado por fuente o agente.
- `summary`: recomendación ejecutiva para el productor.
- `climate`: clima resumido y pronóstico.
- `soil`: datos y recomendaciones de suelo.
- `recommended_crops`: ranking normalizado de cultivos.
- `market`: oportunidades, saturación y alerta de mercado.
- `risks`: riesgos accionables.
- `actions`: próximos pasos ordenados por prioridad.
- `sources`: fuentes consultadas.

## Archivo Schema

El schema formal vive en:

`backend/src/contracts/analysis-result.schema.json`

## Compatibilidad Temporal

Mientras se migra el frontend, el endpoint mantiene campos legacy como `scores`, `forecast`, `rain`, `soil` y `market`. El contrato nuevo vive en `analysis`.
