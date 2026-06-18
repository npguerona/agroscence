export function buildApiStatus(service, ok = true, detail = null) {
  return {
    service,
    ok,
    detail,
    checkedAt: new Date().toISOString()
  };
}
