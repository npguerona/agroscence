-- ================================================================
-- AgroSense — Schema PostgreSQL Fase 2
-- Tablas: users, parcelas, analisis, bitacora, alertas, cultivos
-- ================================================================

-- ── EXTENSIONES ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";  -- para datos geoespaciales

-- ── ENUM TYPES ───────────────────────────────────────────────────
CREATE TYPE plan_tipo      AS ENUM ('free','pro','enterprise');
CREATE TYPE ciclo_estado   AS ENUM ('planificado','activo','cosechado','cancelado');
CREATE TYPE alerta_tipo    AS ENUM ('helada','sequia','lluvia_excesiva','plaga','mercado','bioinsumo');
CREATE TYPE alerta_nivel   AS ENUM ('info','warning','critical');
CREATE TYPE insumo_tipo    AS ENUM ('bioinsumo','agroquimico','fertilizante','herramienta');
CREATE TYPE labor_tipo     AS ENUM ('riego','fumigacion','fertilizacion','deshierbe','poda','cosecha','otro');

-- ================================================================
-- TABLA: users
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  nombre          VARCHAR(120) NOT NULL,
  telefono        VARCHAR(20),
  estado_mx       VARCHAR(80),
  municipio       VARCHAR(80),
  plan            plan_tipo NOT NULL DEFAULT 'free',
  plan_vence_en   TIMESTAMP,
  -- Perfil
  hectareas_total DECIMAL(10,2) DEFAULT 0,
  experiencia_anos INTEGER DEFAULT 0,
  cultivos_fav    TEXT[],         -- ['ajo','lavanda']
  certificaciones TEXT[],         -- ['organico','gap','fairtrade']
  -- Auth
  email_verificado    BOOLEAN DEFAULT FALSE,
  token_verificacion  VARCHAR(255),
  reset_token         VARCHAR(255),
  reset_token_expires TIMESTAMP,
  refresh_token       VARCHAR(500),
  ultimo_login        TIMESTAMP,
  -- Control
  activo          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_plan  ON users(plan);

-- ================================================================
-- TABLA: parcelas
-- ================================================================
CREATE TABLE IF NOT EXISTS parcelas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre          VARCHAR(120) NOT NULL,
  descripcion     TEXT,
  -- Geolocalización
  lat             DECIMAL(10,6) NOT NULL,
  lng             DECIMAL(10,6) NOT NULL,
  altitud_m       INTEGER,
  area_ha         DECIMAL(10,3),
  poligono        JSONB,           -- GeoJSON del polígono dibujado
  municipio       VARCHAR(80),
  estado          VARCHAR(80),
  -- Perfil agroecológico (cache del análisis)
  perfil_cache    JSONB,           -- último análisis completo
  perfil_fecha    TIMESTAMP,
  -- Suelo
  ph_suelo        DECIMAL(4,2),
  textura_suelo   VARCHAR(30),
  materia_organica DECIMAL(5,2),
  -- Control
  activa          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_parcelas_user   ON parcelas(user_id);
CREATE INDEX idx_parcelas_coords ON parcelas(lat, lng);

-- ================================================================
-- TABLA: analisis
-- Cada vez que se analiza una zona/parcela
-- ================================================================
CREATE TABLE IF NOT EXISTS analisis (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      UUID REFERENCES parcelas(id) ON DELETE SET NULL,
  -- Zona analizada
  zona_nombre     VARCHAR(200) NOT NULL,
  lat             DECIMAL(10,6) NOT NULL,
  lng             DECIMAL(10,6) NOT NULL,
  altitud_m       INTEGER,
  -- Datos climáticos (snapshot tiempo real)
  temp_prom_7d    DECIMAL(5,2),
  temp_min_7d     DECIMAL(5,2),
  lluvia_anual_mm INTEGER,
  lluvia_16d_mm   DECIMAL(8,2),
  heladas_n       INTEGER DEFAULT 0,
  alerta_helada   BOOLEAN DEFAULT FALSE,
  temp_anual_prom DECIMAL(5,2),
  -- Suelo
  ph_suelo        DECIMAL(4,2),
  textura_suelo   VARCHAR(30),
  -- Resultados completos (JSON)
  forecast_data   JSONB,           -- pronóstico completo 16 días
  rain_data       JSONB,           -- historial mensual
  soil_data       JSONB,           -- datos SoilGrids
  cultivos_scores JSONB,           -- ranking de cultivos con scores
  market_data     JSONB,           -- análisis de oportunidades Claude
  -- Cultivo seleccionado
  cultivo_elegido VARCHAR(50),
  -- APIs usadas
  apis_status     JSONB,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analisis_user    ON analisis(user_id);
CREATE INDEX idx_analisis_parcela ON analisis(parcela_id);
CREATE INDEX idx_analisis_fecha   ON analisis(creado_en DESC);

-- ================================================================
-- TABLA: ciclos_cultivo
-- Un ciclo = una siembra completa de un cultivo en una parcela
-- ================================================================
CREATE TABLE IF NOT EXISTS ciclos_cultivo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
  analisis_id     UUID REFERENCES analisis(id) ON DELETE SET NULL,
  -- Cultivo
  cultivo_id      VARCHAR(50) NOT NULL,
  cultivo_nombre  VARCHAR(100) NOT NULL,
  variedad        VARCHAR(100),
  -- Temporalidad
  fecha_siembra   DATE NOT NULL,
  fecha_cosecha_est DATE,
  fecha_cosecha_real DATE,
  estado          ciclo_estado NOT NULL DEFAULT 'planificado',
  -- Área y producción
  area_ha         DECIMAL(10,3),
  semilla_kg      DECIMAL(10,2),
  rendimiento_est_kg  INTEGER,
  rendimiento_real_kg INTEGER,
  -- Financiero
  presupuesto_total   DECIMAL(12,2),
  costo_real_total    DECIMAL(12,2) DEFAULT 0,
  ingreso_total       DECIMAL(12,2) DEFAULT 0,
  precio_venta_kg     DECIMAL(10,2),
  canal_venta         VARCHAR(100),
  -- Manejo
  tipo_manejo     VARCHAR(20) DEFAULT 'convencional', -- organico|convencional|transicion
  objetivo        VARCHAR(50) DEFAULT 'fresco',       -- fresco|transformado|mixto
  -- Notas
  notas           TEXT,
  -- Control
  activo          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ciclos_user     ON ciclos_cultivo(user_id);
CREATE INDEX idx_ciclos_parcela  ON ciclos_cultivo(parcela_id);
CREATE INDEX idx_ciclos_estado   ON ciclos_cultivo(estado);
CREATE INDEX idx_ciclos_cultivo  ON ciclos_cultivo(cultivo_id);

-- ================================================================
-- TABLA: bitacora_campo
-- Registro diario/semanal de actividades en el ciclo
-- ================================================================
CREATE TABLE IF NOT EXISTS bitacora_campo (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ciclo_id        UUID NOT NULL REFERENCES ciclos_cultivo(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Actividad
  fecha           DATE NOT NULL,
  labor           labor_tipo NOT NULL,
  descripcion     TEXT NOT NULL,
  -- Insumos aplicados
  insumo_nombre   VARCHAR(200),
  insumo_tipo     insumo_tipo,
  insumo_cantidad DECIMAL(10,3),
  insumo_unidad   VARCHAR(20),  -- kg, L, m3
  insumo_costo    DECIMAL(10,2),
  -- Condiciones
  temp_campo      DECIMAL(5,2),
  humedad_campo   INTEGER,
  observaciones   TEXT,
  -- Foto del campo (URL o base64 hash)
  foto_url        VARCHAR(500),
  -- Diagnóstico fitosanitario si aplica
  diagnostico_id  UUID,  -- referencia a diagnosticos_visuales
  -- Costo de la labor
  costo_labor     DECIMAL(10,2) DEFAULT 0,
  mano_obra_hrs   DECIMAL(6,2) DEFAULT 0,
  costo_mano_obra DECIMAL(10,2) DEFAULT 0,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bitacora_ciclo  ON bitacora_campo(ciclo_id);
CREATE INDEX idx_bitacora_user   ON bitacora_campo(user_id);
CREATE INDEX idx_bitacora_fecha  ON bitacora_campo(fecha DESC);
CREATE INDEX idx_bitacora_labor  ON bitacora_campo(labor);

-- ================================================================
-- TABLA: flujo_caja
-- Proyección y seguimiento de flujo de caja por ciclo
-- ================================================================
CREATE TABLE IF NOT EXISTS flujo_caja (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ciclo_id        UUID NOT NULL REFERENCES ciclos_cultivo(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Periodo
  mes             INTEGER NOT NULL,  -- 1–12
  anio            INTEGER NOT NULL,
  semana_ciclo    INTEGER,           -- semana 1, 2, 3... del ciclo
  -- Proyectado
  egreso_proj     DECIMAL(12,2) DEFAULT 0,
  ingreso_proj    DECIMAL(12,2) DEFAULT 0,
  -- Real
  egreso_real     DECIMAL(12,2) DEFAULT 0,
  ingreso_real    DECIMAL(12,2) DEFAULT 0,
  -- Saldo
  saldo_proj      DECIMAL(12,2) GENERATED ALWAYS AS (ingreso_proj - egreso_proj) STORED,
  saldo_real      DECIMAL(12,2) GENERATED ALWAYS AS (ingreso_real - egreso_real) STORED,
  -- Detalle
  conceptos       JSONB,  -- [{concepto, monto, tipo: egreso|ingreso}]
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_flujo_ciclo ON flujo_caja(ciclo_id);
CREATE UNIQUE INDEX idx_flujo_ciclo_mes ON flujo_caja(ciclo_id, mes, anio);

-- ================================================================
-- TABLA: alertas
-- Alertas automáticas: clima, plagas, mercado
-- ================================================================
CREATE TABLE IF NOT EXISTS alertas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      UUID REFERENCES parcelas(id) ON DELETE CASCADE,
  ciclo_id        UUID REFERENCES ciclos_cultivo(id) ON DELETE CASCADE,
  -- Alerta
  tipo            alerta_tipo NOT NULL,
  nivel           alerta_nivel NOT NULL DEFAULT 'info',
  titulo          VARCHAR(200) NOT NULL,
  mensaje         TEXT NOT NULL,
  datos           JSONB,           -- datos específicos de la alerta
  -- Acción sugerida
  accion          TEXT,
  url_accion      VARCHAR(500),
  -- Estado
  leida           BOOLEAN DEFAULT FALSE,
  leida_en        TIMESTAMP,
  enviada_email   BOOLEAN DEFAULT FALSE,
  enviada_sms     BOOLEAN DEFAULT FALSE,
  -- Expiración
  expira_en       TIMESTAMP,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alertas_user    ON alertas(user_id);
CREATE INDEX idx_alertas_leida   ON alertas(user_id, leida);
CREATE INDEX idx_alertas_tipo    ON alertas(tipo);
CREATE INDEX idx_alertas_fecha   ON alertas(creado_en DESC);

-- ================================================================
-- TABLA: diagnosticos_visuales
-- Resultados del módulo de visión IA (foto → plaga/enfermedad)
-- ================================================================
CREATE TABLE IF NOT EXISTS diagnosticos_visuales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciclo_id        UUID REFERENCES ciclos_cultivo(id) ON DELETE SET NULL,
  -- Imagen
  imagen_hash     VARCHAR(64),     -- SHA256 de la imagen
  imagen_url      VARCHAR(500),    -- si se almacena en S3
  -- Diagnóstico IA
  problema        VARCHAR(200),
  agente_causal   VARCHAR(200),
  tipo_problema   VARCHAR(50),     -- plaga|hongo|bacteria|virus|deficiencia
  severidad       VARCHAR(20),     -- leve|moderada|severa|critica
  confianza       INTEGER,         -- 0–100
  cultivo_detectado VARCHAR(100),
  -- Tratamiento recomendado
  tratamiento_organico   JSONB,
  tratamiento_convencional JSONB,
  insumos_organicos       JSONB,
  insumos_convencionales  JSONB,
  prevencion              TEXT[],
  urgencia_dias           INTEGER,
  -- Raw de Claude
  respuesta_raw   JSONB,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_diag_user   ON diagnosticos_visuales(user_id);
CREATE INDEX idx_diag_ciclo  ON diagnosticos_visuales(ciclo_id);
CREATE INDEX idx_diag_fecha  ON diagnosticos_visuales(creado_en DESC);

-- ================================================================
-- TABLA: material_vegetal
-- Fuentes de semillas, plantas, esquejes, bulbos y costos estimados
-- ================================================================
CREATE TABLE IF NOT EXISTS material_vegetal (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Cultivo y material
  cultivo_id      VARCHAR(50) NOT NULL,
  cultivo_nombre  VARCHAR(100) NOT NULL,
  tipo_material   VARCHAR(30) NOT NULL,    -- semilla|planta|esqueje|bulbo|plantula
  variedad        VARCHAR(100),
  -- Proveedor
  proveedor_nombre VARCHAR(200) NOT NULL,
  proveedor_tipo   VARCHAR(50) DEFAULT 'vivero', -- vivero|casa_semillera|productor_local|cooperativa|mercado_agricola|en_linea|otro
  ubicacion       VARCHAR(160),
  contacto        VARCHAR(200),
  -- Costos y compra
  unidad          VARCHAR(30) DEFAULT 'unidad',
  costo_min       DECIMAL(12,2) DEFAULT 0,
  costo_max       DECIMAL(12,2) DEFAULT 0,
  cantidad_minima VARCHAR(80),
  disponibilidad VARCHAR(30) DEFAULT 'consultar', -- inmediata|por_temporada|sobre_pedido|consultar|agotado
  certificacion   VARCHAR(160),
  estado          VARCHAR(20) DEFAULT 'activo',
  notas           TEXT,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_material_user    ON material_vegetal(user_id);
CREATE INDEX idx_material_cultivo ON material_vegetal(cultivo_id);
CREATE INDEX idx_material_tipo    ON material_vegetal(tipo_material);
CREATE INDEX idx_material_estado  ON material_vegetal(estado);

-- ================================================================
-- TABLA: fauna_nociva
-- Registro y seguimiento de roedores, tuzas, aves y otros daños
-- ================================================================
CREATE TABLE IF NOT EXISTS fauna_nociva (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      UUID NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
  -- Incidencia
  especie         VARCHAR(50) NOT NULL,    -- roedores|tuza|raton|ardilla|pajaros|conejo|otro
  severidad       VARCHAR(20) NOT NULL DEFAULT 'media', -- baja|media|alta|critica
  fecha           DATE NOT NULL,
  ubicacion       VARCHAR(200),
  evidencia       TEXT,
  dano_estimado   TEXT,
  -- Control
  metodo_control  VARCHAR(80),             -- trampas|barreras|manejo_habitat|repelente|ahuyentador|control_profesional|monitoreo
  responsable     VARCHAR(120),
  costo_control   DECIMAL(10,2) DEFAULT 0,
  resultado       TEXT,
  estado          VARCHAR(20) DEFAULT 'detectado', -- detectado|en_control|controlado|eliminado
  notas           TEXT,
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW(),
  actualizado_en  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_fauna_user    ON fauna_nociva(user_id);
CREATE INDEX idx_fauna_parcela ON fauna_nociva(parcela_id);
CREATE INDEX idx_fauna_estado  ON fauna_nociva(estado);
CREATE INDEX idx_fauna_fecha   ON fauna_nociva(fecha DESC);

-- ================================================================
-- TABLA: alertas_regionales
-- Plagas/eventos reportados colaborativamente
-- ================================================================
CREATE TABLE IF NOT EXISTS alertas_regionales (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Ubicación del reporte
  lat             DECIMAL(10,6) NOT NULL,
  lng             DECIMAL(10,6) NOT NULL,
  radio_km        INTEGER DEFAULT 30,
  municipio       VARCHAR(80),
  estado          VARCHAR(80),
  -- Evento
  tipo            VARCHAR(50) NOT NULL,    -- plaga|enfermedad|helada|granizo
  cultivo_afectado VARCHAR(100),
  descripcion     TEXT NOT NULL,
  severidad       VARCHAR(20),
  confirmaciones  INTEGER DEFAULT 0,
  -- Vigencia
  activa          BOOLEAN DEFAULT TRUE,
  expira_en       TIMESTAMP DEFAULT (NOW() + INTERVAL '30 days'),
  -- Control
  creado_en       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_areg_coords ON alertas_regionales(lat, lng);
CREATE INDEX idx_areg_estado ON alertas_regionales(estado, activa);

-- ================================================================
-- TABLA: refresh_tokens
-- ================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(500) UNIQUE NOT NULL,
  expira_en   TIMESTAMP NOT NULL,
  creado_en   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rt_user  ON refresh_tokens(user_id);
CREATE INDEX idx_rt_token ON refresh_tokens(token);

-- ================================================================
-- FUNCIONES Y TRIGGERS
-- ================================================================

-- Auto-actualizar updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.actualizado_en = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_upd     BEFORE UPDATE ON users           FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_parcelas_upd  BEFORE UPDATE ON parcelas        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_ciclos_upd    BEFORE UPDATE ON ciclos_cultivo  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_flujo_upd     BEFORE UPDATE ON flujo_caja      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_material_upd  BEFORE UPDATE ON material_vegetal FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_fauna_upd     BEFORE UPDATE ON fauna_nociva    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ================================================================
-- VIEWS útiles
-- ================================================================

-- Vista: resumen financiero por ciclo
CREATE OR REPLACE VIEW v_resumen_ciclos AS
SELECT
  c.id,
  c.user_id,
  c.cultivo_nombre,
  c.estado,
  c.area_ha,
  c.fecha_siembra,
  c.fecha_cosecha_est,
  c.presupuesto_total,
  c.costo_real_total,
  c.ingreso_total,
  ROUND((c.ingreso_total - c.costo_real_total)::numeric, 2) AS utilidad,
  CASE WHEN c.costo_real_total > 0
    THEN ROUND(((c.ingreso_total - c.costo_real_total) / c.costo_real_total * 100)::numeric, 1)
    ELSE NULL END AS roi_pct,
  COUNT(b.id) AS registros_bitacora,
  SUM(b.costo_labor + b.insumo_costo + b.costo_mano_obra) AS costo_bitacora
FROM ciclos_cultivo c
LEFT JOIN bitacora_campo b ON b.ciclo_id = c.id
GROUP BY c.id;

-- Vista: alertas no leídas por usuario
CREATE OR REPLACE VIEW v_alertas_pendientes AS
SELECT
  a.id, a.user_id, a.tipo, a.nivel, a.titulo, a.mensaje,
  a.creado_en, p.nombre AS parcela_nombre
FROM alertas a
LEFT JOIN parcelas p ON p.id = a.parcela_id
WHERE a.leida = FALSE
  AND (a.expira_en IS NULL OR a.expira_en > NOW())
ORDER BY a.nivel DESC, a.creado_en DESC;
