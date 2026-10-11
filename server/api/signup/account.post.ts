const SIGNUPS_PER_IP_PER_HOUR = 10
const HOUR_MS = 60 * 60 * 1000

// Step 1 — the company's first administrator. Nothing is created yet; it's held (encrypted) in the session.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ firstName?: string, lastName?: string, email?: string, password?: string, acceptTerms?: boolean }>(event)

  const firstName = body?.firstName?.trim()
  const lastName = body?.lastName?.trim()
  const email = body?.email?.trim().toLowerCase()
  if (!firstName || !lastName)
    throw createError({ statusCode: 400, statusMessage: 'First and last name are required' })
  if (!email || !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email))
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid work email' })
  if (!body?.password || body.password.length < SIGNUP_MIN_PASSWORD)
    throw createError({ statusCode: 400, statusMessage: `Password must be at least ${SIGNUP_MIN_PASSWORD} characters` })
  if (!body.acceptTerms)
    throw createError({ statusCode: 400, statusMessage: 'Please accept the Terms of Service and Data Processing Agreement' })

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const limit = await checkRateLimit('signup-ip', ip, SIGNUPS_PER_IP_PER_HOUR, HOUR_MS)
  if (!limit.allowed)
    throw createError({ statusCode: 429, statusMessage: 'Too many sign-up attempts. Please try again later.' })

  if (await lookupOrgIdByEmail(email))
    throw createError({ statusCode: 409, statusMessage: 'This email already belongs to a Canopy workspace. Sign in instead.' })

  const existing = await readSignupDraft(event)
  await saveSignupDraft(event, {
    ...existing,
    firstName,
    lastName,
    email,
    passwordHash: hashPassword(body.password),
  })
  return { ok: true }
})
