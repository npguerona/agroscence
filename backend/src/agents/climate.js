/**
 * Agente de clima — obtiene pronóstico, archivo histórico y elevación.
 * Responsabilidad única: construir el objeto `climate` y la lista `days`.
 */

const dateOffset = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs || 12000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * @param {{ lat: number, lng: number, zona?: string }} params
 * @returns {{ climate: object, forecast: object, rain: object, apis_status: object }}
 */
export async function buildClimate({ lat, lng, zona = "" }) {
  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&timezone=auto&forecast_days=16`;
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${dateOffset(-365)}&end_date=${dateOffset(-1)}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto`;
  const elevationUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`;

  const [forecastData, archiveData, elevationData] = await Promise.all([
    fetchJson(forecastUrl),
    fetchJson(archiveUrl),
    fetchJson(elevationUrl).catch(() => ({}))
  ]);

  const fd = forecastData.daily;
  const ad = archiveData.daily;

  const days = fd.time.map((date, i) => ({
    date,
    tmax: fd.temperature_2m_max[i],
    tmin: fd.temperature_2m_min[i],
    precip: fd.precipitation_sum[i],
    precipProb: fd.precipitation_probability_max?.[i] ?? null,
    wind: fd.windspeed_10m_max?.[i] ?? null,
    helada: fd.temperature_2m_min[i] < 2
  }));

  const tempProm7d = Number(
    (days.slice(0, 7).reduce((sum, d) => sum + (d.tmax + d.tmin) / 2, 0) / 7).toFixed(1)
  );
  const tempMin7d = Number(Math.min(...days.slice(0, 7).map((d) => d.tmin)).toFixed(1));
  const tempMax7d = Number(Math.max(...days.slice(0, 7).map((d) => d.tmax)).toFixed(1));
  const lluvia16dMm = Number(days.reduce((sum, d) => sum + (d.precip || 0), 0).toFixed(1));
  const lluviaAnualMm = Math.round(ad.precipitation_sum.reduce((s, v) => s + (v || 0), 0));
  const tempAnualProm = Number(
    (ad.temperature_2m_max.reduce((s, v, i) => s + (v + (ad.temperature_2m_min[i] || 0)) / 2, 0) /
      ad.temperature_2m_max.length).toFixed(1)
  );
  const altitudM = elevationData.elevation?.[0] ? Math.round(elevationData.elevation[0]) : null;

  const climate = {
    lat,
    lng,
    zona,
    altitudM,
    tempProm7d,
    tempMin7d,
    tempMax7d,
    lluvia16dMm,
    lluviaAnualMm,
    tempAnualProm,
    heladas16d: days.filter((d) => d.helada).length
  };

  const forecast = {
    days,
    resumen: {
      tProm7d: tempProm7d,
      tMin7d: tempMin7d,
      tMax7d: tempMax7d,
      precip16d: lluvia16dMm,
      heladasN: climate.heladas16d,
      alertaHelada: climate.heladas16d > 0,
      timezone: forecastData.timezone
    }
  };

  // Lluvia mensual (últimos 12 meses) para barras de visualización
  const mensual = {};
  ad.time.forEach((t, i) => {
    const m = t.slice(0, 7);
    if (!mensual[m]) mensual[m] = 0;
    mensual[m] += ad.precipitation_sum[i] || 0;
  });
  const meses = Object.entries(mensual)
    .slice(-12)
    .map(([mes, ll]) => ({ mes, lluvia: Math.round(ll) }));

  const rain = {
    totalLluvia: lluviaAnualMm,
    tempAnualProm,
    heladas12m: ad.temperature_2m_min.filter((v) => v !== null && v < 0).length,
    meses
  };

  const apis_status = {
    forecast: "ok",
    archive: "ok",
    elevation: altitudM ? "ok" : "warn"
  };

  return { climate, forecast, rain, apis_status };
}
