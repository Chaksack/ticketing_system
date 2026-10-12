import { put } from '@vercel/blob'

const MAX_SIZE = 4 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Staff image upload (knowledge-article images, work-order photos and signatures). Returns the public URL. */
export default defineEventHandler(async (event) => {
  const user = await requireSessionUser(event)

  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  const folder = parts?.find(part => part.name === 'folder')?.data.toString() === 'field' ? 'field' : 'knowledge'
  if (!file)
    throw createError({ statusCode: 400, statusMessage: 'No file was provided' })
  if (!file.type || !ALLOWED_TYPES[file.type])
    throw createError({ statusCode: 400, statusMessage: 'Upload a PNG, JPEG, WebP or GIF image' })
  if (file.data.length > MAX_SIZE)
    throw createError({ statusCode: 400, statusMessage: 'Images must be smaller than 4MB' })

  const blob = await put(`${folder}/${currentOrgId()}/${user.id}-${Date.now()}.${ALLOWED_TYPES[file.type]}`, file.data, {
    access: 'public',
    contentType: file.type,
  })

  setResponseStatus(event, 201)
  return { url: blob.url, name: file.filename ?? 'image' }
})
