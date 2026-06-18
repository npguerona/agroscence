# AgroSense Implementation Tracker

Documento vivo para saber con precisión en qué paso va el proyecto.  
Regla: se tacha una fase solo cuando está implementada, probada y conectada al flujo de usuario.

## Estado Actual

Fase actual: **Fase 1 avanzada + Fase 2 local funcional**

Último hito verificado:

- Inicio con mapa y vista satelital.
- Motor de análisis conectado a backend en `/api/v2/analysis/zone`.
- Agente local devuelve 12 cultivos y oportunidades de mercado.
- Dashboard Fase 2 conserva parcelas, ciclos, bitácora, flujo, alertas, fauna nociva y material vegetal.
- Contrato formal `analysis-result.v1` creado y expuesto en `data.analysis`.
- Motor Fase 1 ampliado con pestañas Mapa, Diagnóstico e Historial; medición geográfica, GPS, cámara, persistencia local y exportación JSON.
- Centro de dispositivos añadido al Motor Fase 1 para GNSS NMEA, sensores BLE, telemetría de drones/GIS y rutas GeoJSON.

Próximo paso:

**Completar CRUD edición/eliminación de módulos Fase 2 (parcelas, ciclos, bitácora).**

## Fases

- [x] ~~Preparación del workspace y estructura del proyecto~~
- [ ] Fase 1 — MVP real con APIs y orquestador de agentes
- [ ] Fase 2 — Auth, parcelas, ciclos, bitácora, flujo y alertas
- [ ] Fase 3 — Red colaborativa, bioinsumos y compradores
- [ ] Fase 4 — API pública, B2G, white-label y escalamiento

## Checklist De Implementación

- [x] ~~Descompactar primer ZIP base~~
- [x] ~~Crear backend Express local~~
- [x] ~~Crear estructura `frontend/`, `backend/`, `docs/`~~
- [x] ~~Integrar archivos completos de `files2.zip`~~
- [x] ~~Restaurar inicio SaaS con mapa~~
- [x] ~~Agregar vista satelital al mapa~~
- [x] ~~Conservar dashboard Fase 2~~
- [x] ~~Agregar módulo Fauna nociva~~
- [x] ~~Agregar módulo Material vegetal~~
- [x] ~~Crear endpoint `/api/v2/analysis/zone`~~
- [x] ~~Conectar análisis del mapa al backend~~
- [x] ~~Guardar documento maestro en `docs/agrosense_plan_maestro.html`~~
- [x] ~~Crear tracker de implementación~~
- [x] ~~Definir contrato JSON formal del resultado del análisis~~
- [x] ~~Crear `backend/src/contracts/analysis-result.schema.json`~~
- [x] ~~Integrar herramientas de campo en el Motor Fase 1~~
- [x] ~~Agregar medición de área y perímetro con puntos numerados~~
- [x] ~~Agregar GPS, captura de foto e historial local exportable~~
- [x] ~~Agregar centro de dispositivos Serial, BLE y telemetría GIS~~
- [x] ~~Separar agentes backend en `backend/src/agents/`~~
- [x] ~~Crear orquestador central~~
- [x] ~~Adaptar frontend para consumir solo el contrato del orquestador~~
- [x] ~~Guardar análisis en persistencia~~
- [x] ~~Convertir análisis en parcela~~
- [x] ~~Conectar cultivo recomendado con ciclo de cultivo~~
- [ ] Completar CRUD edición/eliminación de módulos Fase 2
- [ ] Implementar diagnóstico visual real
- [ ] Implementar alertas automáticas reales
- [ ] Implementar planes, límites y permisos
- [x] ~~Migrar de JSON local a PostgreSQL/PostGIS~~ (Supabase — híbrido)
- [ ] Crear pruebas automáticas ampliadas

## Criterios De Finalización Por Fase

### Fase 1 — MVP real con APIs y agentes

Se considera completa cuando:

- [x] ~~El contrato JSON del análisis está definido.~~
- [x] ~~Los agentes están separados por responsabilidad.~~
- [x] ~~El orquestador genera un único resultado final.~~
- [x] ~~El frontend renderiza ese contrato sin recalcular resultados críticos.~~
- [ ] El análisis muestra fuentes/API status por capa.
- [ ] Hay fallback si una API externa falla.

### Fase 2 — Plataforma productiva local

Se considera completa cuando:

- [ ] Auth funciona con permisos por plan.
- [ ] Parcelas, ciclos, bitácora, flujo, alertas, fauna y material vegetal tienen CRUD completo.
- [ ] El análisis puede guardarse como parcela.
- [ ] Una recomendación puede iniciar un ciclo.
- [ ] Las alertas se generan por reglas backend.
- [ ] Los datos viven en PostgreSQL/PostGIS.

### Fase 3 — Red y valor agregado

Se considera completa cuando:

- [ ] Existe módulo de bioinsumos.
- [ ] Existe directorio de compradores.
- [ ] Existen alertas regionales colaborativas.
- [ ] Hay validación/confirmación comunitaria de brotes.

### Fase 4 — Escalamiento

Se considera completa cuando:

- [ ] Existe API pública documentada.
- [ ] Existe dashboard Enterprise multi-zona.
- [ ] Hay pagos/suscripciones operativos.
- [ ] Hay preparación para despliegue cloud y white-label.

## Historial

- 2026-06-18: Medición geográfica estabilizada en Motor Fase 1 y portada SaaS. El trazado conserva el tamaño del mapa y muestra hectáreas, m² y perímetro sin desplazar la vista entre vértices. Validado en navegador y con `npm run test:apis`.
- 2026-06-17: Supabase integrado como capa híbrida — db.js con entidades (users, parcelas, ciclos, bitacora, flujo, alertas, material, fauna, analisis). Usa Supabase si SUPABASE_URL+SUPABASE_SERVICE_KEY están en .env, JSON local como fallback. Schema en 002_supabase_schema.sql.
- 2026-06-17: Modal "Guardar parcela" añadido al Motor Fase 1 — crea parcela + ciclo opcional vía API usando el token del Dashboard.
- 2026-06-17: Frontend adaptado — runAnalysis reemplazado por llamada única al orquestador; normalizeContractCrop mapea contrato v1 al render. rain.meses añadido al agente de clima.
- 2026-06-17: Agentes backend separados en `backend/src/agents/` (climate, soil, scoring, market, contract, orchestrator). `server.js` queda solo con rutas. `db.js` consolidado como capa canónica de persistencia.

- 2026-06-17: Centro de dispositivos integrado con Web Serial/NMEA, Web Bluetooth/GATT, importación GeoJSON/GPX/KML/CSV y exportación de rutas de referencia.
- 2026-06-17: Motor Fase 1 integrado con mapa de campo, medición, GPS, diagnóstico fotográfico, historial local y exportación `agrosense.field-export.v1`.
- 2026-06-14: Contrato `analysis-result.v1` creado, documentado y expuesto en `/api/v2/analysis/zone`.
- 2026-06-14: Documento maestro guardado y tracker creado.
