/** Checks the saved AI connection with a tiny request. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  const started = Date.now()
  try {
    const result = await callModel({ system: 'Reply with the single word: ready', messages: [{ role: 'user', text: 'Are you there?' }], tools: [], maxTokens: 10 })
    return { ok: true, latencyMs: Date.now() - started, sample: result.text.slice(0, 40) }
  }
  catch (error: any) {
    return { ok: false, latencyMs: Date.now() - started, error: error?.message ?? 'The AI did not respond.' }
  }
})
