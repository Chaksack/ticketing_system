const SYSTEM = `You write customer-facing knowledge-base articles for a support team. A customer asked the question below in live chat and the AI assistant had no article to answer it.
Draft an article that answers it. Where you don't know the company's specific facts (prices, policies, timelines, steps in their product), write a clear [TO CONFIRM: …] placeholder instead of inventing them.
Use this Markdown only: a first line "TITLE: <short title>", then short paragraphs and numbered steps ("1. ") where useful. No other headings, no HTML.`

/** A question the AI couldn't answer → a draft article for the team to finish, or dismiss it. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  await ensureDb()
  const db = useTenantDb()
  const run = await db.prepare('SELECT id, question, gap_article_id FROM ai_agent_runs WHERE id = ?').get(getRouterParam(event, 'runId') ?? '') as { id: string, question: string, gap_article_id: string | null } | undefined
  if (!run)
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const { action } = await readBody<{ action?: 'draft' | 'dismiss' }>(event) ?? {}

  if (action === 'dismiss') {
    await db.prepare('UPDATE ai_agent_runs SET gap_article_id = \'dismissed\' WHERE id = ?').run(run.id)
    return { ok: true }
  }
  if (run.gap_article_id && run.gap_article_id !== 'dismissed')
    return { article: await loadKbArticle(run.gap_article_id) }

  let aiError: string | undefined
  const generated = await generateAiText(user, SYSTEM, `Customer question: ${run.question}`).catch((error: any) => {
    aiError = error?.statusMessage ?? 'The AI could not write the draft.'
    return null
  })
  let title = run.question.replace(/\s+/g, ' ').trim().slice(0, 120)
  let body = `**Question.** ${run.question.trim()}\n\n**Answer.** [TO CONFIRM]\n\n1. `
  if (generated) {
    const titleLine = generated.match(/^TITLE: ?(\S.*)$/m)
    if (titleLine?.[1])
      title = titleLine[1].trim()
    body = generated.replace(/^TITLE:.*$/m, '').trim()
  }

  const id = await nextPrefixedId('kb_article', 'KB')
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO kb_articles (id, title, body, status, visibility, author_id, author_name, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', 'public', ?, ?, ?, ?)
  `).run(id, title.slice(0, 200), body, user.id, user.name, now, now)
  await db.prepare('UPDATE ai_agent_runs SET gap_article_id = ? WHERE id = ?').run(id, run.id)
  setResponseStatus(event, 201)
  return { article: await loadKbArticle(id), aiWritten: !!generated, aiError }
})
