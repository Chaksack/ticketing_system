/** Website chat on/off and its button text. (The other channels are configured where they live.) */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  await ensureDb()
  if (getRouterParam(event, 'id') !== 'web_chat')
    throw createError({ statusCode: 400, statusMessage: 'Only the website chat is set up here' })
  const body = await readBody<{ enabled?: boolean, title?: string, launcher?: string }>(event) ?? {}
  const current = await loadChannelSetting('web_chat')
  await saveChannelSetting('web_chat', body.enabled ?? current.enabled, {
    title: (body.title ?? current.config.title ?? '').trim().slice(0, 60),
    launcher: (body.launcher ?? current.config.launcher ?? '').trim().slice(0, 30),
  })
  return { channels: await listSupportChannels() }
})
