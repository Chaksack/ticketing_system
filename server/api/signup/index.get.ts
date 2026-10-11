// The sign-up in progress (to resume the wizard after a refresh), minus the password hash.
export default defineEventHandler(async (event) => {
  return { draft: publicDraft(await readSignupDraft(event)) }
})
