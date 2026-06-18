/**
 * Orquestador central — coordina todos los agentes y produce el resultado unificado.
 *
 * Flujo:
 *   buildClimate  ─┐
 *   buildSoil     ─┤→ rankCrops → buildMarket → buildAnalysisContract
 *
 * El resultado incluye tanto la forma legacy (compatibilidad con frontend actual)
 * como el contrato canónico en `result.analysis`.
 */

import { buildClimate } from "./climate.js";
import { buildSoil } from "./soil.js";
import { rankCrops } from "./scoring.js";
import { buildMarket } from "./market.js";
import { buildAnalysisContract } from "./contract.js";

const nowIso = () => new Date().toISOString();

/**
 * @param {{ lat: number|string, lng: number|string, zona?: string, area_ha?: number|null }} params
 * @returns {Promise<object>} resultado completo con `analysis` (contrato v1) y datos legacy
 */
export async function analyzeZone({ lat, lng, zona = "", area_ha = null }) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Latitud y longitud inválidas");
  }

  // Agentes de datos (paralelo donde sea posible)
  const [climateResult, soilResult] = await Promise.all([
    buildClimate({ lat: latitude, lng: longitude, zona }),
    buildSoil({ lat: latitude, lng: longitude })
  ]);

  // Enriquecer climate con pH del suelo para scoring
  const climateWithSoil = { ...climateResult.climate, ph: soilResult.soil.ph };

  // Agente de scoring
  const scores = rankCrops(climateWithSoil);

  // Agente de mercado
  const { market, agent_status } = await buildMarket({
    zona,
    climate: climateResult.climate,
    scores
  });

  // Estado de APIs consolidado
  const apis_status = {
    ...climateResult.apis_status,
    soilgrids: soilResult.api_status,
    agent: agent_status
  };

  // Resultado interno (legacy + contrato)
  const result = {
    zona: zona || "Parcela seleccionada",
    lat: latitude,
    lng: longitude,
    altitud: climateResult.climate.altitudM,
    area_ha: Number.isFinite(Number(area_ha)) ? Number(area_ha) : null,
    climate: climateResult.climate,
    forecast: climateResult.forecast,
    rain: climateResult.rain,
    soil: soilResult.soil,
    scores,
    market,
    apis_status,
    ts: nowIso()
  };

  // Contrato canónico — única fuente de verdad para el frontend
  result.analysis = buildAnalysisContract(result);

  return result;
}
