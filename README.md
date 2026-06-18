# AgroSense

Dashboard Fase 2 para registrar parcelas, ciclos de cultivo, fuentes de material vegetal, bitácora de campo, control de fauna nociva, flujo de caja y alertas.

## Estructura

```text
frontend/   Interfaces HTML de fases y módulos.
backend/    API Express, migraciones y datos locales de desarrollo.
docs/       Pitch, pruebas y material de apoyo.
```

## Frontend canónico

- `frontend/agrosense_fase1_motor.html`: Motor Fase 1 oficial. Incluye análisis de zona, mapa, medición, GPS, diagnóstico de campo e historial local.
- `frontend/agrosense_fase2_dashboard.html`: Dashboard Fase 2 oficial.

No crear ni mantener copias paralelas de estos archivos. Los diagnósticos de campo permanecen disponibles sin conexión mediante almacenamiento local. Los mapas base dependen de los tiles que el navegador haya conservado en caché y no se garantiza su disponibilidad total sin red.

### Dispositivos de campo

El Motor Fase 1 admite:

- Receptores GPS/GNSS NMEA mediante Web Serial en Chrome de escritorio.
- Sensores Bluetooth Low Energy mediante UUID de servicio y característica GATT proporcionados por el fabricante.
- Telemetría de drones y datos GIS en GeoJSON, GPX, KML y CSV (`lat`/`lon`).
- Exportación de perímetro y ruta de levantamiento como GeoJSON de referencia.

La aplicación no envía comandos de vuelo ni controla motores o pilotos automáticos. Serial, Bluetooth, GPS, micrófono y cámara requieren contexto seguro y autorización del usuario.

## Documentos De Control

- `docs/agrosense_plan_maestro.html`: documento maestro del producto.
- `docs/IMPLEMENTATION_TRACKER.md`: avance vivo de fases, checklist y próximos pasos.
- `docs/ANALYSIS_RESULT_CONTRACT.md`: contrato estable del resultado de análisis.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

La app usa un backend Express con persistencia local en `backend/data/local-db.json` para poder iterar rápido sin configurar PostgreSQL. El archivo `backend/migrations/001_schema.sql` queda como contrato de base de datos para la siguiente fase.

## Variables

Copia `.env.example` a `.env` si quieres cambiar `PORT`, `JWT_SECRET` o `FRONTEND_URL`.
