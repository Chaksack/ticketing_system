interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
}

let resolver: ((ok: boolean) => void) | null = null

/** Promise-based confirm dialog (rendered once by <ConfirmDialogHost> in app.vue). */
export function useConfirm() {
  const state = useState<ConfirmState>('confirm-dialog', () => ({ open: false, title: '' }))

  function confirm(options: ConfirmOptions) {
    resolver?.(false)
    state.value = { ...options, open: true }
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function settle(ok: boolean) {
    state.value = { ...state.value, open: false }
    resolver?.(ok)
    resolver = null
  }

  return { state, confirm, settle }
}
