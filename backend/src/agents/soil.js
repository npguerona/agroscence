/**
 * Agente de suelo — consulta SoilGrids para pH y textura.
 * Responsabilidad única: construir el objeto `soil`.
 */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 12000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * @param {{ lat: number, lng: number }} params
 * @returns {{ soil: object, api_status: string }}
 */
export async function buildSoil({ lat, lng }) {
  const soilUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=phh2o&depth=5-15cm&value=mean`;

  let soilResult = null;
  let api_status = "warn";

  try {
    soilResult = await fetchJson(soilUrl);
    api_status = "ok";
  } catch {
    api_status = "warn";
  }

  const phRaw = soilResult?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;
  const ph = phRaw ? Number((phRaw / 10).toFixed(1)) : null;

  const soil = {
    ph,
    disponible: Boolean(ph),
    textura: null,
    organic_matter_pct: null
  };

  if (!ph) api_status = "warn";

  return { soil, api_status };
}
