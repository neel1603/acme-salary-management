// `ApiError.detail` isn't reliably a string. A router-raised ValueError/ConflictError (422/409)
// sends a plain string, but FastAPI's own body-validation 422s send an array of
// {loc, msg, type} objects -- a naive `{error.detail}` would render "[object Object]" for those.
// This normalizes both shapes (plus anything unexpected) to a single displayable string.
export function formatApiErrorDetail(error, fallback = 'Something went wrong. Please try again.') {
  const detail = error?.detail

  if (typeof detail === 'string' && detail.length > 0) {
    return detail
  }

  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => item?.msg)
      .filter(Boolean)
      .join('; ') || fallback
  }

  return fallback
}
