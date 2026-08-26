// Temporary diagnostic endpoint — lets an admin confirm whether the Gmail env vars are actually
// visible to the running server, without ever exposing their values. Delete once the "not
// configured" issue in production is resolved.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const config = useRuntimeConfig()

  function fieldStatus(value: string) {
    return {
      set: !!value,
      length: value?.length ?? 0,
    }
  }

  return {
    gmailClientId: fieldStatus(config.gmailClientId),
    gmailClientSecret: fieldStatus(config.gmailClientSecret),
    gmailRefreshToken: fieldStatus(config.gmailRefreshToken),
    gmailSender: fieldStatus(config.gmailSender),
    gmailFromName: fieldStatus(config.gmailFromName),
  }
})
