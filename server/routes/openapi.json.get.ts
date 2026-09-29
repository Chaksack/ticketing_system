// Public OpenAPI document for the external APIs (server/utils/publicApiSpec.ts), rendered by Scalar at /docs.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300')
  return buildPublicApiSpec(getRequestURL(event).origin)
})
