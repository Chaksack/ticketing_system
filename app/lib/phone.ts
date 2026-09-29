// Loose on purpose — international formats vary. Allows "+233 24 123 4567", "024-123-4567",
// "(024) 1234567"; requires 7–15 actual digits.
const PHONE_CHARS = /^\+?[\d\s\-().]+$/

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  return PHONE_CHARS.test(trimmed) && digits.length >= 7 && digits.length <= 15
}
