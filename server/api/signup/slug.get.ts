// Live check for the workspace address field.
export default defineEventHandler(async (event) => {
  const value = getQuery(event).value
  if (typeof value !== 'string' || !value.trim())
    return { slug: '', available: false, reason: 'Choose an address' }
  return await checkSlugAvailable(value)
})
