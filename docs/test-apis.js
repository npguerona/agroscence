const baseUrl = process.env.AGROSENSE_URL || "http://localhost:3000";

const healthResponse = await fetch(`${baseUrl}/api/v2/health`);
const health = await healthResponse.json();
console.log("health", health);

const analysisResponse = await fetch(`${baseUrl}/api/v2/analysis/zone`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ lat: 21.0186, lng: -101.2591, zona: "Guanajuato QA" })
});
const analysis = await analysisResponse.json();

if (!analysis.ok) throw new Error(`analysis failed: ${analysis.error}`);
if (analysis.data.analysis?.contract_version !== "analysis-result.v1") {
  throw new Error("analysis contract missing or invalid");
}

console.log("analysis", {
  contract: analysis.data.analysis.contract_version,
  crops: analysis.data.analysis.recommended_crops.length,
  top: analysis.data.analysis.summary.top_crop_id,
  source: analysis.data.analysis.market.source
});
