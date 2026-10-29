/** Tag colours (tags.color) → chip classes, shared by tickets, chats and Support setup → Tags. */
export const TAG_COLORS: Record<string, { label: string, chip: string, dot: string }> = {
  gray: { label: 'Grey', chip: 'bg-muted text-foreground', dot: 'bg-[#868685]' },
  green: { label: 'Green', chip: 'bg-brand-mist text-brand-forest dark:bg-brand-spruce dark:text-brand-mist', dot: 'bg-brand-forest' },
  lime: { label: 'Lime', chip: 'bg-brand-lime text-brand-forest', dot: 'bg-brand-lime' },
  blue: { label: 'Blue', chip: 'bg-sky-100 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100', dot: 'bg-sky-500' },
  amber: { label: 'Amber', chip: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100', dot: 'bg-amber-500' },
  red: { label: 'Red', chip: 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-100', dot: 'bg-red-500' },
  purple: { label: 'Purple', chip: 'bg-violet-100 text-violet-900 dark:bg-violet-500/15 dark:text-violet-100', dot: 'bg-violet-500' },
}

export const tagChipClass = (color: string) => (TAG_COLORS[color] ?? TAG_COLORS.gray!).chip
