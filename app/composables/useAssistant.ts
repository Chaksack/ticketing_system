/** Opens the header's Ask AI panel from anywhere, optionally sending a question straight away. */
export function useAssistant() {
  const isOpen = useState('assistant-open', () => false)
  const pendingQuestion = useState<string | null>('assistant-pending-question', () => null)

  function ask(question?: string) {
    pendingQuestion.value = question?.trim() || null
    isOpen.value = true
  }

  return { isOpen, pendingQuestion, ask }
}
