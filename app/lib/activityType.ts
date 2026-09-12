export const ACTIVITY_TYPE_SUGGESTIONS = ['Meeting', 'Site Visit', 'Client Visit', 'Scouting', 'Other']

const ACTIVITY_TYPE_PALETTE = [
  { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500' },
  { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', dot: 'bg-purple-500' },
  { badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', dot: 'bg-rose-500' },
  { badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', dot: 'bg-cyan-500' },
]

/** Deterministic color per free-text activity type, so the same label always renders the same way. */
function activityTypeStyle(activityType?: string) {
  if (!activityType)
    return { badge: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/40' }

  let hash = 0
  for (const char of activityType.trim().toLowerCase())
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  return ACTIVITY_TYPE_PALETTE[hash % ACTIVITY_TYPE_PALETTE.length]!
}

export function activityTypeBadgeClass(activityType?: string) {
  return activityTypeStyle(activityType).badge
}

export function activityTypeDotClass(activityType?: string) {
  return activityTypeStyle(activityType).dot
}
