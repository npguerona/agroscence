/**
 * Agente de mercado — genera análisis de nicho y oportunidades.
 * Intenta primero el agente Anthropic; cae en el agente local si no hay API key o falla.
 */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 20000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function buildGlobalAnalogs(scores) {
  const seen = new Set();
  const analogs = [];
  for (const cultivo of scores) {
    for (const analog of cultivo.analogosGlobales || []) {
      const key = `${analog.cultivo}-${analog.region}`;
      if (seen.has(key)) continue;
      seen.add(key);
      analogs.push({
        cultivo: analog.cultivo,
        region: analog.region,
        viabilidad: cultivo.nivel,
        cultivo_base: cultivo.nombre,
        categoria_base: cultivo.categoria || "cultivo",
        justificacion: `${analog.justificacion} Perfil semejante a ${cultivo.nombre} (${cultivo.score}/100).`
      });
    }
  }
  return analogs.slice(0, 6);
}

/**
 * Agente local (sin API externa) — siempre disponible como fallback.
 */
export function buildLocalMarketAgent({ zona, scores }) {
  const top = scores.slice(0, 5);
  const nichos = top.slice(0, 4).map((cultivo) => ({
    cultivo: cultivo.nombre,
    razon: `${cultivo.nivel === "alta" ? "Alta" : "Media"} viabilidad climática (${cultivo.categoria || "cultivo"}) y posibilidad de vender como ${cultivo.producto}.`,
    precio_mx: `$${cultivo.precioTransformado}/kg transformado aprox.`,
    competencia: cultivo.roiPotencial >= 10 || cultivo.categoria === "arbol_frutal" ? "media" : "alta",
    mercado: cultivo.roiPotencial >= 12 || cultivo.categoria === "arbol_frutal" ? "nacional/exportación" : "local/nacional"
  }));

  return {
    fuente: "agente-local",
    cultivos_saturados: scores.filter((c) => c.score < 50).slice(0, 2).map((c) => c.nombre),
    nichos_oportunidad: nichos,
    cultivos_analogos_globales: buildGlobalAnalogs(scores),
    recomendacion: `Para ${zona || "esta parcela"}, prioriza ${top[0]?.nombre || "el cultivo mejor puntuado"} y valida suelo local antes de invertir. El agente recomienda comparar material vegetal certificado y canal de venta antes de iniciar ciclo.`,
    alerta_mercado: "Los precios son aproximados; confirma demanda local, comprador y costos logísticos antes de sembrar."
  };
}

/**
 * Agente Anthropic — requiere ANTHROPIC_API_KEY en el entorno.
 * @returns {object|null} resultado del agente o null si no hay API key
 */
export async function buildAnthropicMarketAgent({ zona, climate, scores }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Eres consultor agrícola senior para México/LATAM.
Zona: ${zona || "parcela seleccionada"}.
Altitud: ${climate.altitudM || "N/D"} msnm.
Temperatura promedio 7d: ${climate.tempProm7d}°C.
Lluvia anual: ${climate.lluviaAnualMm}mm.
Cultivos mejor puntuados: ${scores.slice(0, 8).map((c) => `${c.nombre} (${c.categoria || "cultivo"}) ${c.score}/100`).join(", ")}.

Incluye arboles frutales cuando sean viables. En cultivos_analogos_globales propone especies de otras zonas del mundo con caracteristicas agroclimaticas semejantes; no repitas solamente los mismos cultivos del ranking local.

Responde SOLO JSON válido con:
{"cultivos_saturados":["nombre"],"nichos_oportunidad":[{"cultivo":"nombre","razon":"breve","precio_mx":"$X/kg","competencia":"baja|media|alta","mercado":"local|nacional|exportacion"}],"cultivos_analogos_globales":[{"cultivo":"nombre","region":"origen","viabilidad":"alta|media|baja","justificacion":"breve"}],"recomendacion":"2 oraciones","alerta_mercado":"tendencia o advertencia"}`;

  try {
    const response = await fetchJson("https://api.anthropic.com/v1/messages", {
      method: "POST",
      timeoutMs: 20000,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }]
      })
    });
    const raw = response.content?.[0]?.text || "";
    return { ...JSON.parse(raw.replace(/```json|```/g, "").trim()), fuente: "anthropic" };
  } catch (error) {
    return { error: error.message, fuente: "anthropic-error" };
  }
}

/**
 * Punto de entrada del agente de mercado.
 * Intenta Anthropic, cae en local si falla o no hay API key.
 * @returns {{ market: object, agent_status: string }}
 */
export async function buildMarket({ zona, climate, scores }) {
  const anthropicResult = await buildAnthropicMarketAgent({ zona, climate, scores });

  if (anthropicResult && !anthropicResult.error) {
    return { market: anthropicResult, agent_status: "anthropic" };
  }

  const localResult = buildLocalMarketAgent({ zona, scores });
  return {
    market: { ...localResult, anthropic_error: anthropicResult?.error || null },
    agent_status: "agente-local"
  };
}
