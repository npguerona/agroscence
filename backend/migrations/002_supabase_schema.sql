-- ================================================================
-- AgroSense — Schema Supabase (Fase 2)
-- Pega este SQL en: Supabase Dashboard → SQL Editor → New query
-- IDs: TEXT (nanoid) para compatibilidad con el backend actual
-- RLS deshabilitado — acceso solo via service_role key desde el servidor
-- ================================================================

-- ── USERS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  nombre          TEXT NOT NULL,
  estado_mx       TEXT,
  plan            TEXT NOT NULL DEFAULT 'free',
  ultimo_login    TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PARCELAS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  altitud_m       INTEGER,
  area_ha         DOUBLE PRECISION,
  municipio       TEXT,
  estado          TEXT,
  activa          BOOLEAN DEFAULT TRUE,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parcelas_user ON parcelas(user_id);

-- ── CICLOS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ciclos (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id          TEXT NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
  cultivo_id          TEXT NOT NULL,
  cultivo_nombre      TEXT NOT NULL,
  variedad            TEXT,
  fecha_siembra       TEXT NOT NULL,
  fecha_cosecha_est   TEXT,
  estado              TEXT DEFAULT 'planificado',
  area_ha             DOUBLE PRECISION,
  semilla_kg          DOUBLE PRECISION,
  presupuesto_total   DOUBLE PRECISION DEFAULT 0,
  costo_real_total    DOUBLE PRECISION DEFAULT 0,
  ingreso_total       DOUBLE PRECISION DEFAULT 0,
  tipo_manejo         TEXT DEFAULT 'convencional',
  objetivo            TEXT DEFAULT 'fresco',
  notas               TEXT,
  activo              BOOLEAN DEFAULT TRUE,
  creado_en           TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ciclos_user    ON ciclos(user_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_parcela ON ciclos(parcela_id);

-- ── BITÁCORA ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bitacora (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciclo_id        TEXT NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  fecha           TEXT NOT NULL,
  labor           TEXT DEFAULT 'otro',
  descripcion     TEXT NOT NULL,
  insumo_nombre   TEXT,
  insumo_tipo     TEXT,
  insumo_cantidad DOUBLE PRECISION,
  insumo_unidad   TEXT,
  insumo_costo    DOUBLE PRECISION DEFAULT 0,
  costo_labor     DOUBLE PRECISION DEFAULT 0,
  costo_mano_obra DOUBLE PRECISION DEFAULT 0,
  temp_campo      DOUBLE PRECISION,
  observaciones   TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bitacora_user  ON bitacora(user_id);
CREATE INDEX IF NOT EXISTS idx_bitacora_ciclo ON bitacora(ciclo_id);

-- ── FLUJO DE CAJA ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flujo (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciclo_id        TEXT NOT NULL REFERENCES ciclos(id) ON DELETE CASCADE,
  mes             INTEGER NOT NULL,
  anio            INTEGER NOT NULL,
  semana_ciclo    INTEGER,
  egreso_proj     DOUBLE PRECISION DEFAULT 0,
  ingreso_proj    DOUBLE PRECISION DEFAULT 0,
  egreso_real     DOUBLE PRECISION DEFAULT 0,
  ingreso_real    DOUBLE PRECISION DEFAULT 0,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_flujo_user  ON flujo(user_id);
CREATE INDEX IF NOT EXISTS idx_flujo_ciclo ON flujo(ciclo_id);

-- ── ALERTAS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alertas (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL DEFAULT 'info',
  nivel           TEXT NOT NULL DEFAULT 'info',
  titulo          TEXT,
  mensaje         TEXT,
  leida           BOOLEAN DEFAULT FALSE,
  leida_en        TIMESTAMPTZ,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alertas_user ON alertas(user_id);

-- ── MATERIAL VEGETAL ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS material (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cultivo_id        TEXT NOT NULL,
  cultivo_nombre    TEXT NOT NULL,
  tipo_material     TEXT NOT NULL,
  variedad          TEXT,
  proveedor_nombre  TEXT NOT NULL,
  proveedor_tipo    TEXT DEFAULT 'vivero',
  ubicacion         TEXT,
  contacto          TEXT,
  unidad            TEXT DEFAULT 'unidad',
  costo_min         DOUBLE PRECISION DEFAULT 0,
  costo_max         DOUBLE PRECISION DEFAULT 0,
  cantidad_minima   TEXT,
  disponibilidad    TEXT DEFAULT 'consultar',
  certificacion     TEXT,
  estado            TEXT DEFAULT 'activo',
  notas             TEXT,
  creado_en         TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_material_user    ON material(user_id);
CREATE INDEX IF NOT EXISTS idx_material_cultivo ON material(cultivo_id);

-- ── FAUNA NOCIVA ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fauna (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      TEXT NOT NULL REFERENCES parcelas(id) ON DELETE CASCADE,
  especie         TEXT NOT NULL,
  severidad       TEXT DEFAULT 'media',
  fecha           TEXT NOT NULL,
  ubicacion       TEXT,
  evidencia       TEXT,
  dano_estimado   TEXT,
  metodo_control  TEXT,
  responsable     TEXT,
  costo_control   DOUBLE PRECISION DEFAULT 0,
  resultado       TEXT,
  estado          TEXT DEFAULT 'detectado',
  notas           TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fauna_user    ON fauna(user_id);
CREATE INDEX IF NOT EXISTS idx_fauna_parcela ON fauna(parcela_id);

-- ── ANÁLISIS (historial) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analisis (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parcela_id      TEXT,
  zona_nombre     TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  altitud_m       INTEGER,
  contract        JSONB,     -- contrato analysis-result.v1 completo
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analisis_user    ON analisis(user_id);
CREATE INDEX IF NOT EXISTS idx_analisis_parcela ON analisis(parcela_id);
CREATE INDEX IF NOT EXISTS idx_analisis_fecha   ON analisis(creado_en DESC);

-- ================================================================
-- Deshabilitar RLS (el servidor usa service_role key)
-- ================================================================
ALTER TABLE users       DISABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas    DISABLE ROW LEVEL SECURITY;
ALTER TABLE ciclos      DISABLE ROW LEVEL SECURITY;
ALTER TABLE bitacora    DISABLE ROW LEVEL SECURITY;
ALTER TABLE flujo       DISABLE ROW LEVEL SECURITY;
ALTER TABLE alertas     DISABLE ROW LEVEL SECURITY;
ALTER TABLE material    DISABLE ROW LEVEL SECURITY;
ALTER TABLE fauna       DISABLE ROW LEVEL SECURITY;
ALTER TABLE analisis    DISABLE ROW LEVEL SECURITY;
