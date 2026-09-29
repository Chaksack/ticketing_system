type RefreshHandler = () => unknown

// Client-only registry (handlers are added in onMounted) for things that live outside the current
// page — header notifications, chat unread count, sidebar channels — so they reload too.
const handlers = new Set<RefreshHandler>()

const MIN_SPIN_MS = 600

/**
 * "Refresh everything" for the header button. Pages load their data in onMounted, so bumping
 * `pageKey` (bound as the `:key` of the page container in layouts/default.vue) remounts the
 * current page and re-runs all of its fetches, however that page does them.
 */
export function useAppRefresh() {
  const pageKey = useState('app-refresh-page-key', () => 0)
  const isRefreshing = useState('app-refresh-busy', () => false)

  /** Registers a reload for a component that isn't part of the page; removed again on unmount. */
  function onAppRefresh(handler: RefreshHandler) {
    onMounted(() => handlers.add(handler))
    onBeforeUnmount(() => handlers.delete(handler))
  }

  async function refreshAll() {
    if (isRefreshing.value)
      return
    isRefreshing.value = true
    const startedAt = Date.now()
    try {
      pageKey.value++
      await Promise.allSettled([refreshNuxtData(), ...[...handlers].map(handler => handler())])
      const remaining = MIN_SPIN_MS - (Date.now() - startedAt)
      if (remaining > 0)
        await new Promise(resolve => setTimeout(resolve, remaining))
    }
    finally {
      isRefreshing.value = false
    }
  }

  return { pageKey, isRefreshing, refreshAll, onAppRefresh }
}
