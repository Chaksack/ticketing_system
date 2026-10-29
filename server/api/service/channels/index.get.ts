/** Every way customers reach support, the embed code for the website chat, and its settings. */
export default defineEventHandler(async (event) => {
  await requireServiceStaff(event)
  await ensureDb()
  const org = await getOrganization(currentOrgId()).catch(() => null)
  return { channels: await listSupportChannels(), workspace: org?.slug ?? 'canopy' }
})
