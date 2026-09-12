interface NewLineBody {
  accountCode?: string
  debit?: number
  credit?: number
  memo?: string
}

interface NewJournalEntryBody {
  entryDate?: string
  memo?: string
  lines?: NewLineBody[]
}

export default defineEventHandler(async (event) => {
  const user = await requireFinance(event)

  const body = await readBody<NewJournalEntryBody>(event)

  if (!body?.entryDate) {
    throw createError({ statusCode: 400, statusMessage: 'entryDate is required' })
  }

  const lines = body.lines ?? []
  for (const line of lines) {
    if (!line.accountCode?.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Each line needs an accountCode' })
    }
  }

  await ensureDb()

  const entry = await postJournalEntry({
    entryDate: body.entryDate,
    memo: body.memo,
    source: 'manual',
    postedBy: user.id,
    lines: lines.map(line => ({
      accountCode: line.accountCode!.trim(),
      debit: line.debit,
      credit: line.credit,
      memo: line.memo,
    })),
  })

  setResponseStatus(event, 201)
  return { entry }
})
