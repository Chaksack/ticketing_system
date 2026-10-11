import { ORG_APPS } from '../../../app/types/organization'

// Step 3 — which apps to switch on (they control the sidebar; changeable later).
export default defineEventHandler(async (event) => {
  const draft = await requireSignupDraft(event)
  if (!draft.org)
    throw createError({ statusCode: 409, statusMessage: 'Tell us about your organisation first' })

  const body = await readBody<{ apps?: string[] }>(event)
  const apps = (body?.apps ?? []).filter(app => ORG_APPS.some(a => a.id === app))
  if (!apps.length)
    throw createError({ statusCode: 400, statusMessage: 'Choose at least one app' })

  await saveSignupDraft(event, { ...draft, apps })
  return { ok: true }
})
