import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { nanoid } from "nanoid";

import db from "./db.js";
import { analyzeZone } from "./agents/orchestrator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "../..");
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "agrosense-local-dev-secret-change-me";

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use(express.static(path.join(PROJECT_ROOT, "frontend")));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();
const ok   = (res, data)         => res.json({ ok: true, data });
const fail = (res, status, error) => res.status(status).json({ ok: false, error });

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return fail(res, 401, "Token requerido");
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user    = await db.users.findById(payload.sub);
    if (!user) return fail(res, 401, "Usuario no encontrado");
    req.user = user;
    next();
  } catch {
    return fail(res, 401, "Sesión inválida o expirada");
  }
}

// ─── Decorators ──────────────────────────────────────────────────────────────

function publicUser(user) {
  return { id: user.id, nombre: user.nombre, email: user.email, estado_mx: user.estado_mx || null, plan: user.plan || "free" };
}

function signUser(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

async function decorateParcelas(userId) {
  const [lista, todoCiclos] = await Promise.all([
    db.parcelas.list(userId),
    db.ciclos.list(userId)
  ]);
  return lista.map(p => {
    const cs = todoCiclos.filter(c => c.parcela_id === p.id);
    return { ...p, ciclos_activos: cs.filter(c => c.estado === "activo").length, ciclos_total: cs.length };
  });
}

async function decorateCiclos(userId) {
  const [lista, todasParcelas] = await Promise.all([
    db.ciclos.list(userId),
    db.parcelas.list(userId)
  ]);
  return await Promise.all(lista.map(async c => {
    const parcela   = todasParcelas.find(p => p.id === c.parcela_id);
    const registros = await db.bitacora.forCiclo(c.id);
    const costoBitacora = registros.reduce(
      (sum, i) => sum + Number(i.insumo_costo||0) + Number(i.costo_labor||0) + Number(i.costo_mano_obra||0), 0
    );
    return { ...c, parcela_nombre: parcela?.nombre||"Sin parcela", registros: registros.length, costo_acumulado: costoBitacora, costo_real_total: Math.max(Number(c.costo_real_total||0), costoBitacora) };
  }));
}

function buildInitialFlow(ciclo) {
  const start  = ciclo.fecha_siembra ? new Date(`${ciclo.fecha_siembra}T00:00:00`) : new Date();
  const budget = Number(ciclo.presupuesto_total || 0);
  const monthlyCost = budget > 0 ? Math.round(budget / 6) : 0;
  return Array.from({ length: 8 }, (_, i) => {
    const date = new Date(start);
    date.setMonth(start.getMonth() + i);
    const isHarvestWindow = i >= 6;
    return {
      id: nanoid(), ciclo_id: ciclo.id, user_id: ciclo.user_id,
      mes: date.getMonth() + 1, anio: date.getFullYear(), semana_ciclo: i * 4 + 1,
      egreso_proj:  isHarvestWindow ? Math.round(monthlyCost * 0.4) : monthlyCost,
      ingreso_proj: isHarvestWindow ? Math.round(budget * (i === 6 ? 1.4 : 2.1)) : 0,
      egreso_real: 0, ingreso_real: 0,
      creado_en: nowIso(), actualizado_en: nowIso()
    };
  });
}

// ─── Páginas ──────────────────────────────────────────────────────────────────

app.get("/",         (_req, res) => res.sendFile(path.join(PROJECT_ROOT, "frontend", "agrosense_saas.html")));
app.get("/fase1",    (_req, res) => res.sendFile(path.join(PROJECT_ROOT, "frontend", "agrosense_fase1_motor.html")));
app.get("/dashboard",(_req, res) => res.sendFile(path.join(PROJECT_ROOT, "frontend", "agrosense_fase2_dashboard.html")));

// ─── API ──────────────────────────────────────────────────────────────────────

app.get("/api/v2/health", (_req, res) => ok(res, { status: "ok", service: "agrosense-api" }));

// Análisis de zona → orquestador
app.post("/api/v2/analysis/zone", async (req, res) => {
  try {
    const result = await analyzeZone(req.body || {});
    ok(res, result);
  } catch (error) {
    fail(res, 400, error.message || "No se pudo analizar la zona");
  }
});

// Auth
app.post("/api/v2/auth/register", async (req, res) => {
  const { nombre, email, password, estado_mx } = req.body;
  if (!nombre || !email || !password) return fail(res, 400, "Nombre, email y contraseña son requeridos");
  if (password.length < 8) return fail(res, 400, "La contraseña debe tener al menos 8 caracteres");
  const normalizedEmail = String(email).trim().toLowerCase();
  if (await db.users.emailExists(normalizedEmail)) return fail(res, 409, "Ese email ya está registrado");
  const user = { id: nanoid(), email: normalizedEmail, password_hash: await bcrypt.hash(password, 10), nombre: String(nombre).trim(), estado_mx: estado_mx || null, plan: "free", creado_en: nowIso(), actualizado_en: nowIso() };
  await db.users.create(user);
  ok(res, { accessToken: signUser(user), user: publicUser(user) });
});

app.post("/api/v2/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await db.users.findByEmail(String(email || "").trim().toLowerCase());
  if (!user || !(await bcrypt.compare(password || "", user.password_hash))) return fail(res, 401, "Email o contraseña incorrectos");
  await db.users.update(user.id, { ultimo_login: nowIso() });
  ok(res, { accessToken: signUser(user), user: publicUser(user) });
});

// Parcelas
app.get("/api/v2/parcelas", auth, async (req, res) => {
  try { ok(res, await decorateParcelas(req.user.id)); } catch(e) { fail(res, 500, e.message); }
});

app.post("/api/v2/parcelas", auth, async (req, res) => {
  const { nombre, lat, lng } = req.body;
  if (!nombre || lat === undefined || lng === undefined) return fail(res, 400, "Nombre, latitud y longitud son requeridos");
  const parcela = { id: nanoid(), user_id: req.user.id, nombre: String(nombre).trim(), lat: Number(lat), lng: Number(lng), altitud_m: req.body.altitud_m ?? null, area_ha: req.body.area_ha ?? null, municipio: req.body.municipio || null, estado: req.body.estado || req.user.estado_mx || null, activa: true, creado_en: nowIso(), actualizado_en: nowIso() };
  await db.parcelas.create(parcela);
  ok(res, { ...parcela, ciclos_activos: 0, ciclos_total: 0 });
});

// Ciclos
app.get("/api/v2/ciclos", auth, async (req, res) => {
  try { ok(res, await decorateCiclos(req.user.id)); } catch(e) { fail(res, 500, e.message); }
});

app.post("/api/v2/ciclos", auth, async (req, res) => {
  const { parcela_id, cultivo_id, cultivo_nombre, fecha_siembra } = req.body;
  const parcela = await db.parcelas.findOne(parcela_id, req.user.id);
  if (!parcela) return fail(res, 404, "Parcela no encontrada");
  if (!cultivo_id || !cultivo_nombre || !fecha_siembra) return fail(res, 400, "Cultivo y fecha de siembra son requeridos");
  const ciclo = { id: nanoid(), user_id: req.user.id, parcela_id, cultivo_id, cultivo_nombre, variedad: req.body.variedad || null, fecha_siembra, fecha_cosecha_est: req.body.fecha_cosecha_est || null, estado: "planificado", area_ha: req.body.area_ha ?? parcela.area_ha ?? null, semilla_kg: req.body.semilla_kg ?? null, presupuesto_total: req.body.presupuesto_total ?? 0, costo_real_total: 0, ingreso_total: 0, tipo_manejo: req.body.tipo_manejo || "convencional", objetivo: req.body.objetivo || "fresco", notas: req.body.notas || null, activo: true, creado_en: nowIso(), actualizado_en: nowIso() };
  await db.ciclos.create(ciclo);
  await db.flujo.bulkCreate(buildInitialFlow(ciclo));
  const decorated = await decorateCiclos(req.user.id);
  ok(res, decorated.find(c => c.id === ciclo.id));
});

// Bitácora
app.get("/api/v2/bitacora", auth, async (req, res) => {
  try { ok(res, await db.bitacora.list(req.user.id, { cicloId: req.query.ciclo_id, labor: req.query.labor })); } catch(e) { fail(res, 500, e.message); }
});

app.post("/api/v2/bitacora", auth, async (req, res) => {
  const ciclo = await db.ciclos.findOne(req.body.ciclo_id, req.user.id);
  if (!ciclo) return fail(res, 404, "Ciclo no encontrado");
  if (!req.body.fecha || !req.body.descripcion) return fail(res, 400, "Fecha y descripción son requeridas");
  const item = { id: nanoid(), user_id: req.user.id, ciclo_id: ciclo.id, fecha: req.body.fecha, labor: req.body.labor || "otro", descripcion: req.body.descripcion, insumo_nombre: req.body.insumo_nombre || null, insumo_tipo: req.body.insumo_tipo || null, insumo_cantidad: req.body.insumo_cantidad ?? null, insumo_unidad: req.body.insumo_unidad || null, insumo_costo: req.body.insumo_costo ?? 0, costo_labor: req.body.costo_labor ?? 0, costo_mano_obra: req.body.costo_mano_obra ?? 0, temp_campo: req.body.temp_campo ?? null, observaciones: req.body.observaciones || null, creado_en: nowIso() };
  const saved = await db.bitacora.create(item);
  ok(res, saved);
});

// Flujo de caja
app.get("/api/v2/flujo", auth, async (req, res) => {
  try {
    const items = await db.flujo.list(req.user.id, { cicloId: req.query.ciclo_id });
    ok(res, items.map(i => ({ ...i, saldo_proj: Number(i.ingreso_proj||0) - Number(i.egreso_proj||0), saldo_real: Number(i.ingreso_real||0) - Number(i.egreso_real||0) })));
  } catch(e) { fail(res, 500, e.message); }
});

// Material vegetal
app.get("/api/v2/material", auth, async (req, res) => {
  try { ok(res, await db.material.list(req.user.id, { tipo: req.query.tipo, cultivo: req.query.cultivo })); } catch(e) { fail(res, 500, e.message); }
});

app.post("/api/v2/material", auth, async (req, res) => {
  if (!req.body.cultivo_nombre || !req.body.tipo_material || !req.body.proveedor_nombre) return fail(res, 400, "Cultivo, tipo de material y proveedor son requeridos");
  const item = { id: nanoid(), user_id: req.user.id, cultivo_id: req.body.cultivo_id || String(req.body.cultivo_nombre).toLowerCase().replace(/\s+/g, "_"), cultivo_nombre: req.body.cultivo_nombre, tipo_material: req.body.tipo_material, variedad: req.body.variedad || null, proveedor_nombre: req.body.proveedor_nombre, proveedor_tipo: req.body.proveedor_tipo || "vivero", ubicacion: req.body.ubicacion || null, contacto: req.body.contacto || null, unidad: req.body.unidad || "unidad", costo_min: req.body.costo_min ?? 0, costo_max: req.body.costo_max ?? req.body.costo_min ?? 0, cantidad_minima: req.body.cantidad_minima || null, disponibilidad: req.body.disponibilidad || "consultar", certificacion: req.body.certificacion || null, estado: req.body.estado || "activo", notas: req.body.notas || null, creado_en: nowIso(), actualizado_en: nowIso() };
  ok(res, await db.material.create(item));
});

app.patch("/api/v2/material/:id", auth, async (req, res) => {
  const allowed = ["cultivo_id","cultivo_nombre","tipo_material","variedad","proveedor_nombre","proveedor_tipo","ubicacion","contacto","unidad","costo_min","costo_max","cantidad_minima","disponibilidad","certificacion","estado","notas"];
  const data = Object.fromEntries(allowed.filter(k => Object.hasOwn(req.body, k)).map(k => [k, req.body[k]]));
  const updated = await db.material.update(req.params.id, req.user.id, data);
  if (!updated) return fail(res, 404, "Fuente de material vegetal no encontrada");
  ok(res, updated);
});

app.delete("/api/v2/material/:id", auth, async (req, res) => {
  const deleted = await db.material.remove(req.params.id, req.user.id);
  if (!deleted) return fail(res, 404, "Fuente de material vegetal no encontrada");
  ok(res, { deleted: true });
});

// Fauna nociva
app.get("/api/v2/fauna", auth, async (req, res) => {
  try {
    const items = await db.fauna.list(req.user.id, { parcelaId: req.query.parcela_id, estado: req.query.estado });
    const parcelasList = await db.parcelas.list(req.user.id);
    ok(res, items.map(i => ({ ...i, parcela_nombre: parcelasList.find(p => p.id === i.parcela_id)?.nombre || "Sin parcela" })));
  } catch(e) { fail(res, 500, e.message); }
});

app.post("/api/v2/fauna", auth, async (req, res) => {
  const parcela = await db.parcelas.findOne(req.body.parcela_id, req.user.id);
  if (!parcela) return fail(res, 404, "Parcela no encontrada");
  if (!req.body.especie || !req.body.fecha) return fail(res, 400, "Especie y fecha son requeridas");
  const item = { id: nanoid(), user_id: req.user.id, parcela_id: parcela.id, especie: req.body.especie, severidad: req.body.severidad || "media", fecha: req.body.fecha, ubicacion: req.body.ubicacion || null, evidencia: req.body.evidencia || null, dano_estimado: req.body.dano_estimado || null, metodo_control: req.body.metodo_control || null, responsable: req.body.responsable || null, costo_control: req.body.costo_control ?? 0, resultado: req.body.resultado || null, estado: req.body.estado || "detectado", notas: req.body.notas || null, creado_en: nowIso(), actualizado_en: nowIso() };
  ok(res, { ...(await db.fauna.create(item)), parcela_nombre: parcela.nombre });
});

app.patch("/api/v2/fauna/:id", auth, async (req, res) => {
  const allowed = ["especie","severidad","fecha","ubicacion","evidencia","dano_estimado","metodo_control","responsable","costo_control","resultado","estado","notas"];
  const data = Object.fromEntries(allowed.filter(k => Object.hasOwn(req.body, k)).map(k => [k, req.body[k]]));
  const updated = await db.fauna.update(req.params.id, req.user.id, data);
  if (!updated) return fail(res, 404, "Registro de fauna no encontrado");
  ok(res, updated);
});

app.delete("/api/v2/fauna/:id", auth, async (req, res) => {
  const deleted = await db.fauna.remove(req.params.id, req.user.id);
  if (!deleted) return fail(res, 404, "Registro de fauna no encontrado");
  ok(res, { deleted: true });
});

// Alertas
app.get("/api/v2/alertas", auth, async (req, res) => {
  try { ok(res, await db.alertas.list(req.user.id)); } catch(e) { fail(res, 500, e.message); }
});

app.patch("/api/v2/alertas/:id/leer", auth, async (req, res) => {
  const updated = await db.alertas.markRead(req.params.id, req.user.id, nowIso());
  if (!updated) return fail(res, 404, "Alerta no encontrada");
  ok(res, updated);
});

app.patch("/api/v2/alertas/leer-todas", auth, async (req, res) => {
  await db.alertas.markAllRead(req.user.id, nowIso());
  ok(res, { updated: true });
});

// Fallback SPA
app.get("*", (_req, res) => res.sendFile(path.join(PROJECT_ROOT, "frontend", "agrosense_saas.html")));

app.listen(PORT, () => console.log(`AgroSense listo en http://localhost:${PORT}`));
