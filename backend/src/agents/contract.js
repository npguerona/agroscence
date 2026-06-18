/**
 * Agente de contrato — transforma el resultado interno al contrato público `analysis-result.v1`.
 * Responsabilidad única: construir el JSON canónico del análisis.
 */

import { nanoid } from "nanoid";

function apiStatusEntry(status, detail = null) {
  return { status, detail };
}

/**
 * @param {object} result  resultado interno del orquestador
 * @returns {object} contrato `analysis-result.v1`
 */
export function buildAnalysisContract(result) {
  const topCrop = result.scores?.[0] || null;
  const market = result.market || {};
  const risks = [];

  if (result.climate?.heladas16d > 0) {
    risks.push({
      type: "helada",
      level: "warning",
      message: `${result.climate.heladas16d} dia(s) con riesgo de helada en el pronostico.`,
      action: "Revisar proteccion nocturna, riego preventivo o postergar siembra sensible."
    });
  }
  if (result.climate?.lluvia16dMm > 80) {
    risks.push({
      type: "lluvia_excesiva",
      level: "warning",
      message: `Lluvia prevista alta: ${result.climate.lluvia16dMm}mm en 16 dias.`,
      action: "Revisar drenaje, compactacion y riesgo de enfermedades fungicas."
    });
  }
  for (const crop of result.scores?.slice(0, 3) || []) {
    for (const alert of crop.alertas || []) {
      risks.push({
        type: "cultivo",
        level: crop.score < 50 ? "critical" : "warning",
        message: `${crop.nombre}: ${alert}`,
        action: null
      });
    }
  }

  const apiStatus = {
    forecast: apiStatusEntry(result.apis_status?.forecast || "warn"),
    archive: apiStatusEntry(result.apis_status?.archive || "warn"),
    elevation: apiStatusEntry(result.apis_status?.elevation || "warn"),
    soilgrids: apiStatusEntry(result.apis_status?.soilgrids || "warn"),
    market_agent: apiStatusEntry(
      result.apis_status?.agent === "anthropic" ? "ok" : "warn",
      market.anthropic_error || result.apis_status?.agent || null
    )
  };

  return {
    contract_version: "analysis-result.v1",
    analysis_id: nanoid(),
    generated_at: result.ts,
    location: {
      label: result.zona,
      lat: result.lat,
      lng: result.lng,
      altitude_m: result.altitud ?? null,
      area_ha: result.area_ha ?? null
    },
    api_status: apiStatus,
    summary: {
      headline: topCrop
        ? `${topCrop.nombre} lidera el ranking con score ${topCrop.score}/100`
        : "Analisis generado",
      recommendation:
        market.recomendacion ||
        (topCrop
          ? `Prioriza ${topCrop.nombre} y valida suelo local antes de invertir.`
          : "Revisar resultados tecnicos antes de decidir."),
      confidence: topCrop?.score >= 75 ? "high" : topCrop?.score >= 50 ? "medium" : "low",
      top_crop_id: topCrop?.id || null
    },
    climate: {
      temp_avg_7d_c: result.climate.tempProm7d,
      temp_min_7d_c: result.climate.tempMin7d,
      temp_max_7d_c: result.climate.tempMax7d ?? null,
      rain_annual_mm: result.climate.lluviaAnualMm,
      rain_16d_mm: result.climate.lluvia16dMm,
      frost_days_16d: result.climate.heladas16d,
      forecast_days: (result.forecast?.days || []).map((day) => ({
        date: day.date,
        tmax_c: day.tmax,
        tmin_c: day.tmin,
        rain_mm: day.precip || 0,
        frost_risk: Boolean(day.helada)
      }))
    },
    soil: {
      available: Boolean(result.soil?.disponible),
      ph: result.soil?.ph ?? null,
      texture: result.soil?.textura ?? null,
      organic_matter_pct: result.soil?.organic_matter_pct ?? null,
      recommendations: result.soil?.ph
        ? ["Validar pH con analisis local antes de fertilizacion."]
        : ["SoilGrids no devolvio suelo completo; tomar muestra local."]
    },
    recommended_crops: (result.scores || []).map((crop) => ({
      id: crop.id,
      name: crop.nombre,
      emoji: crop.emoji || "🌱",
      category: crop.categoria || "cultivo",
      score: crop.score,
      level: crop.nivel,
      material_type: crop.material || crop.costoMaterialTipo || "semilla",
      product: crop.producto,
      fresh_price_mxn: crop.precioFresco,
      transformed_price_mxn: crop.precioTransformado,
      roi_multiplier: crop.roiPotencial || Math.round(crop.precioTransformado / Math.max(crop.precioFresco, 1)),
      cycle_months: crop.duracion,
      alerts: crop.alertas || [],
      recommendations: crop.recomendaciones || []
    })),
    market: {
      source: market.fuente || "agente-local",
      recommendation: market.recomendacion || null,
      market_alert: market.alerta_mercado || null,
      saturated_crops: market.cultivos_saturados || [],
      opportunities: (market.nichos_oportunidad || []).map((item) => ({
        crop: item.cultivo,
        reason: item.razon,
        price_mx: item.precio_mx,
        competition: item.competencia,
        market: item.mercado
      })),
      global_analogs: (market.cultivos_analogos_globales || []).map((item) => ({
        crop: item.cultivo,
        region: item.region,
        viability: item.viabilidad,
        base_crop: item.cultivo_base || null,
        base_category: item.categoria_base || null,
        rationale: item.justificacion
      }))
    },
    risks,
    actions: [
      {
        priority: 1,
        label: "Guardar analisis como parcela",
        description:
          "Conservar coordenadas, clima, suelo y ranking para iniciar seguimiento productivo.",
        target: "parcelas"
      },
      {
        priority: 2,
        label: "Cotizar material vegetal",
        description: topCrop
          ? `Buscar ${topCrop.material || "material vegetal"} de ${topCrop.nombre} con proveedor confiable.`
          : "Comparar proveedores de material vegetal.",
        target: "material"
      },
      {
        priority: 3,
        label: "Validar suelo local",
        description:
          "Tomar muestra fisica para confirmar pH, textura y materia organica.",
        target: "suelo"
      }
    ],
    sources: Object.entries(apiStatus).map(([name, value]) => ({
      name,
      status: value.status,
      detail: value.detail
    }))
  };
}
