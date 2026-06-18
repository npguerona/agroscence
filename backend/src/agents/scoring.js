/**
 * Agente de scoring — puntúa y ordena cultivos según clima y suelo.
 * Responsabilidad única: dado un `climate`, devolver `scores` ordenados.
 */

import { cultivosAnalisis } from "../cultivos.js";

/**
 * @param {object} cultivo
 * @param {object} climate
 * @returns {object} cultivo enriquecido con score, nivel, alertas, recomendaciones
 */
export function scoreCultivo(cultivo, climate) {
  let score = 100;
  const alertas = [];
  const recomendaciones = [];
  const { tempProm7d, tempMin7d, lluviaAnualMm, lluvia16dMm, ph } = climate;

  if (tempProm7d < cultivo.tempMin) {
    score -= 30;
    alertas.push(`Temperatura promedio ${tempProm7d}°C bajo el mínimo recomendado (${cultivo.tempMin}°C).`);
  } else if (tempProm7d > cultivo.tempMax) {
    score -= 25;
    alertas.push(`Temperatura promedio ${tempProm7d}°C sobre el máximo recomendado (${cultivo.tempMax}°C).`);
  } else {
    recomendaciones.push("Temperatura dentro del rango productivo.");
  }

  const heladaPenalty = { muy_sensible: 40, sensible: 25, moderado: 12, tolerante: 5 }[cultivo.heladas] || 15;
  if (tempMin7d < 2) {
    score -= heladaPenalty;
    alertas.push(`Riesgo de helada: mínima prevista ${tempMin7d}°C.`);
  } else if (tempMin7d < 5 && cultivo.heladas !== "tolerante") {
    score -= 8;
    recomendaciones.push("Monitorear noches frías antes de siembra.");
  }

  if (lluviaAnualMm < cultivo.lluviaMin) {
    score -= 20;
    alertas.push(`Lluvia anual ${lluviaAnualMm}mm bajo el rango recomendado (${cultivo.lluviaMin}-${cultivo.lluviaMax}mm).`);
  } else if (lluviaAnualMm > cultivo.lluviaMax) {
    score -= 15;
    alertas.push(`Lluvia anual ${lluviaAnualMm}mm sobre el rango recomendado; revisar drenaje.`);
  } else {
    recomendaciones.push("Lluvia anual dentro del rango óptimo.");
  }

  if (lluvia16dMm > 80) {
    score -= 10;
    alertas.push(`Lluvia intensa prevista: ${lluvia16dMm}mm en 16 días.`);
  }

  if (ph && (ph < 5.5 || ph > 8.0)) {
    score -= 8;
    recomendaciones.push(`Validar suelo local: pH estimado ${ph}.`);
  }

  const distOpt = Math.abs(tempProm7d - cultivo.tempOptima);
  if (distOpt <= 3) recomendaciones.push("Temperatura muy cercana al óptimo del cultivo.");

  const scoreFinal = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ...cultivo,
    score: scoreFinal,
    nivel: scoreFinal >= 75 ? "alta" : scoreFinal >= 50 ? "media" : "baja",
    alertas,
    recomendaciones,
    roiPotencial: Math.round(cultivo.precioTransformado / Math.max(cultivo.precioFresco, 1)),
    costoMaterialTipo: cultivo.material,
    tempProm: tempProm7d,
    tempMin7d,
    lluvia16d: lluvia16dMm
  };
}

/**
 * @param {object} climate  (con campo `ph` si disponible)
 * @returns {Array} cultivos ordenados de mayor a menor score
 */
export function rankCrops(climate) {
  return cultivosAnalisis
    .map((cultivo) => scoreCultivo(cultivo, climate))
    .sort((a, b) => b.score - a.score);
}
