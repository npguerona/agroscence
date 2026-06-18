/**
 * Capa de datos híbrida — Supabase si hay credenciales, JSON local como fallback.
 *
 * Uso en server.js:
 *   import db from "./db.js";
 *   const user = await db.users.findByEmail("...");
 *   const parcelas = await db.parcelas.list(userId);
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DATA_FILE  = path.resolve(__dirname, "../../data/local-db.json");

// ── Supabase client (sólo si hay credenciales) ────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // service_role key (server-side only)
const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  : null;

export const MODE = supabase ? "supabase" : "local";
if (MODE === "supabase") {
  console.log("🗄  DB: Supabase conectado →", SUPABASE_URL);
} else {
  console.log("🗄  DB: modo local (JSON) — agrega SUPABASE_URL y SUPABASE_SERVICE_KEY para usar Supabase");
}

// ── Helpers locales ───────────────────────────────────────────────
function normalizeLocal(db) {
  db.users    ||= [];
  db.parcelas ||= [];
  db.ciclos   ||= [];
  db.bitacora ||= [];
  db.alertas  ||= [];
  db.flujo    ||= [];
  db.fauna    ||= [];
  db.material ||= [];
  return db;
}

async function readLocal() {
  try {
    return normalizeLocal(JSON.parse(await fs.readFile(DATA_FILE, "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    const empty = normalizeLocal({});
    await writeLocal(empty);
    return empty;
  }
}

async function writeLocal(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2));
}

// ── Supabase helper (lanza error claro) ───────────────────────────
async function sq(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`Supabase: ${error.message}`);
  return data;
}

// ================================================================
// USERS
// ================================================================
const users = {
  async findByEmail(email) {
    if (supabase) {
      const rows = await sq(supabase.from("users").select("*").eq("email", email).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.users.find(u => u.email === email) || null;
  },

  async findById(id) {
    if (supabase) {
      const rows = await sq(supabase.from("users").select("*").eq("id", id).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.users.find(u => u.id === id) || null;
  },

  async create(user) {
    if (supabase) {
      const rows = await sq(supabase.from("users").insert(user).select());
      return rows[0];
    }
    const db = await readLocal();
    db.users.push(user);
    await writeLocal(db);
    return user;
  },

  async update(id, data) {
    if (supabase) {
      const rows = await sq(supabase.from("users").update(data).eq("id", id).select());
      return rows[0];
    }
    const db = await readLocal();
    const idx = db.users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    Object.assign(db.users[idx], data);
    await writeLocal(db);
    return db.users[idx];
  },

  async emailExists(email) {
    if (supabase) {
      const rows = await sq(supabase.from("users").select("id").eq("email", email).limit(1));
      return rows.length > 0;
    }
    const db = await readLocal();
    return db.users.some(u => u.email === email);
  }
};

// ================================================================
// PARCELAS
// ================================================================
const parcelas = {
  async list(userId) {
    if (supabase) {
      return await sq(supabase.from("parcelas").select("*").eq("user_id", userId).eq("activa", true));
    }
    const db = await readLocal();
    return db.parcelas.filter(p => p.user_id === userId && p.activa !== false);
  },

  async create(parcela) {
    if (supabase) {
      const rows = await sq(supabase.from("parcelas").insert(parcela).select());
      return rows[0];
    }
    const db = await readLocal();
    db.parcelas.push(parcela);
    await writeLocal(db);
    return parcela;
  },

  async findOne(id, userId) {
    if (supabase) {
      const rows = await sq(supabase.from("parcelas").select("*").eq("id", id).eq("user_id", userId).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.parcelas.find(p => p.id === id && p.user_id === userId) || null;
  }
};

// ================================================================
// CICLOS
// ================================================================
const ciclos = {
  async list(userId) {
    if (supabase) {
      return await sq(supabase.from("ciclos").select("*").eq("user_id", userId).eq("activo", true));
    }
    const db = await readLocal();
    return db.ciclos.filter(c => c.user_id === userId && c.activo !== false);
  },

  async create(ciclo) {
    if (supabase) {
      const rows = await sq(supabase.from("ciclos").insert(ciclo).select());
      return rows[0];
    }
    const db = await readLocal();
    db.ciclos.push(ciclo);
    await writeLocal(db);
    return ciclo;
  },

  async findOne(id, userId) {
    if (supabase) {
      const rows = await sq(supabase.from("ciclos").select("*").eq("id", id).eq("user_id", userId).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.ciclos.find(c => c.id === id && c.user_id === userId) || null;
  },

  async forParcela(parcelaId, userId) {
    if (supabase) {
      return await sq(supabase.from("ciclos").select("*").eq("parcela_id", parcelaId).eq("user_id", userId));
    }
    const db = await readLocal();
    return db.ciclos.filter(c => c.parcela_id === parcelaId && c.user_id === userId);
  }
};

// ================================================================
// BITÁCORA
// ================================================================
const bitacora = {
  async list(userId, { cicloId, labor } = {}) {
    if (supabase) {
      let q = supabase.from("bitacora").select("*").eq("user_id", userId).order("fecha", { ascending: false });
      if (cicloId) q = q.eq("ciclo_id", cicloId);
      if (labor)   q = q.eq("labor", labor);
      return await sq(q);
    }
    const db = await readLocal();
    return db.bitacora
      .filter(i => i.user_id === userId)
      .filter(i => !cicloId || i.ciclo_id === cicloId)
      .filter(i => !labor   || i.labor === labor)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  },

  async create(entry) {
    if (supabase) {
      const rows = await sq(supabase.from("bitacora").insert(entry).select());
      return rows[0];
    }
    const db = await readLocal();
    db.bitacora.push(entry);
    await writeLocal(db);
    return entry;
  },

  async forCiclo(cicloId) {
    if (supabase) {
      return await sq(supabase.from("bitacora").select("*").eq("ciclo_id", cicloId));
    }
    const db = await readLocal();
    return db.bitacora.filter(b => b.ciclo_id === cicloId);
  }
};

// ================================================================
// FLUJO DE CAJA
// ================================================================
const flujo = {
  async list(userId, { cicloId } = {}) {
    if (supabase) {
      let q = supabase.from("flujo").select("*").eq("user_id", userId).order("anio").order("mes");
      if (cicloId) q = q.eq("ciclo_id", cicloId);
      return await sq(q);
    }
    const db = await readLocal();
    return db.flujo
      .filter(i => i.user_id === userId)
      .filter(i => !cicloId || i.ciclo_id === cicloId)
      .sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  },

  async bulkCreate(entries) {
    if (supabase) {
      return await sq(supabase.from("flujo").insert(entries).select());
    }
    const db = await readLocal();
    db.flujo.push(...entries);
    await writeLocal(db);
    return entries;
  }
};

// ================================================================
// ALERTAS
// ================================================================
const alertas = {
  async list(userId) {
    if (supabase) {
      return await sq(supabase.from("alertas").select("*").eq("user_id", userId).order("creado_en", { ascending: false }));
    }
    const db = await readLocal();
    return db.alertas.filter(i => i.user_id === userId).sort((a, b) => String(b.creado_en).localeCompare(String(a.creado_en)));
  },

  async findOne(id, userId) {
    if (supabase) {
      const rows = await sq(supabase.from("alertas").select("*").eq("id", id).eq("user_id", userId).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.alertas.find(a => a.id === id && a.user_id === userId) || null;
  },

  async markRead(id, userId, ts) {
    if (supabase) {
      const rows = await sq(supabase.from("alertas").update({ leida: true, leida_en: ts }).eq("id", id).eq("user_id", userId).select());
      return rows[0];
    }
    const db = await readLocal();
    const item = db.alertas.find(a => a.id === id && a.user_id === userId);
    if (!item) return null;
    item.leida = true; item.leida_en = ts;
    await writeLocal(db);
    return item;
  },

  async markAllRead(userId, ts) {
    if (supabase) {
      await sq(supabase.from("alertas").update({ leida: true, leida_en: ts }).eq("user_id", userId).eq("leida", false));
      return true;
    }
    const db = await readLocal();
    db.alertas.filter(a => a.user_id === userId).forEach(a => { a.leida = true; a.leida_en = a.leida_en || ts; });
    await writeLocal(db);
    return true;
  }
};

// ================================================================
// MATERIAL VEGETAL
// ================================================================
const material = {
  async list(userId, { tipo, cultivo } = {}) {
    if (supabase) {
      let q = supabase.from("material").select("*").eq("user_id", userId);
      if (tipo)    q = q.eq("tipo_material", tipo);
      if (cultivo) q = q.eq("cultivo_id", cultivo);
      const rows = await sq(q);
      return rows.sort((a, b) => String(a.cultivo_nombre).localeCompare(String(b.cultivo_nombre)));
    }
    const db = await readLocal();
    return db.material
      .filter(i => i.user_id === userId)
      .filter(i => !tipo    || i.tipo_material === tipo)
      .filter(i => !cultivo || i.cultivo_id === cultivo)
      .sort((a, b) => String(a.cultivo_nombre).localeCompare(String(b.cultivo_nombre)));
  },

  async create(item) {
    if (supabase) {
      const rows = await sq(supabase.from("material").insert(item).select());
      return rows[0];
    }
    const db = await readLocal();
    db.material.push(item);
    await writeLocal(db);
    return item;
  },

  async update(id, userId, data) {
    if (supabase) {
      const rows = await sq(supabase.from("material").update({ ...data, actualizado_en: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select());
      return rows[0] || null;
    }
    const db = await readLocal();
    const item = db.material.find(e => e.id === id && e.user_id === userId);
    if (!item) return null;
    Object.assign(item, data);
    item.actualizado_en = new Date().toISOString();
    await writeLocal(db);
    return item;
  },

  async remove(id, userId) {
    if (supabase) {
      const { count } = await supabase.from("material").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
      return (count || 0) > 0;
    }
    const db = await readLocal();
    const before = db.material.length;
    db.material = db.material.filter(e => !(e.id === id && e.user_id === userId));
    if (db.material.length === before) return false;
    await writeLocal(db);
    return true;
  }
};

// ================================================================
// FAUNA NOCIVA
// ================================================================
const fauna = {
  async list(userId, { parcelaId, estado } = {}) {
    if (supabase) {
      let q = supabase.from("fauna").select("*").eq("user_id", userId).order("fecha", { ascending: false });
      if (parcelaId) q = q.eq("parcela_id", parcelaId);
      if (estado)    q = q.eq("estado", estado);
      return await sq(q);
    }
    const db = await readLocal();
    return db.fauna
      .filter(i => i.user_id === userId)
      .filter(i => !parcelaId || i.parcela_id === parcelaId)
      .filter(i => !estado    || i.estado === estado)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  },

  async create(item) {
    if (supabase) {
      const rows = await sq(supabase.from("fauna").insert(item).select());
      return rows[0];
    }
    const db = await readLocal();
    db.fauna.push(item);
    await writeLocal(db);
    return item;
  },

  async update(id, userId, data) {
    if (supabase) {
      const rows = await sq(supabase.from("fauna").update({ ...data, actualizado_en: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select());
      return rows[0] || null;
    }
    const db = await readLocal();
    const item = db.fauna.find(e => e.id === id && e.user_id === userId);
    if (!item) return null;
    Object.assign(item, data);
    item.actualizado_en = new Date().toISOString();
    await writeLocal(db);
    return item;
  },

  async remove(id, userId) {
    if (supabase) {
      const { count } = await supabase.from("fauna").delete({ count: "exact" }).eq("id", id).eq("user_id", userId);
      return (count || 0) > 0;
    }
    const db = await readLocal();
    const before = db.fauna.length;
    db.fauna = db.fauna.filter(e => !(e.id === id && e.user_id === userId));
    if (db.fauna.length === before) return false;
    await writeLocal(db);
    return true;
  },

  async findOne(id, userId) {
    if (supabase) {
      const rows = await sq(supabase.from("fauna").select("*").eq("id", id).eq("user_id", userId).limit(1));
      return rows[0] || null;
    }
    const db = await readLocal();
    return db.fauna.find(e => e.id === id && e.user_id === userId) || null;
  }
};

// ================================================================
// ANÁLISIS (historial)
// ================================================================
const analisis = {
  async save(entry) {
    if (supabase) {
      const rows = await sq(supabase.from("analisis").insert(entry).select());
      return rows[0];
    }
    // En modo local no persistimos análisis individuales (solo se guarda si el usuario crea parcela)
    return entry;
  },

  async list(userId) {
    if (supabase) {
      return await sq(supabase.from("analisis").select("*").eq("user_id", userId).order("creado_en", { ascending: false }));
    }
    return [];
  }
};

// ── Exportación ───────────────────────────────────────────────────
export default { users, parcelas, ciclos, bitacora, flujo, alertas, material, fauna, analisis, MODE };
