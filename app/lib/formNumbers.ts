import * as z from 'zod'

// vee-validate hands `<Input type="number">` values over as real numbers (NaN when the box is
// empty), not strings — so amount fields must accept a number. Blank/NaN becomes `undefined`
// instead of failing with "Expected string, received number" or silently turning into 0.
function toNumberOrUndefined(value: unknown) {
  if (value === '' || value === null || value === undefined)
    return undefined
  const number = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  return Number.isNaN(number) ? undefined : number
}

/**
 * For plain `v-model` on `<Input type="number">` outside a vee-validate form: Vue already casts the
 * value to a number (or leaves '' when blank), so string methods like `.trim()` throw on it.
 * Returns the number, or `undefined` when blank/invalid.
 */
export function parseAmountInput(value: unknown): number | undefined {
  return toNumberOrUndefined(value)
}

/** An optional, non-negative amount (e.g. estimated value, price). */
export function optionalAmount() {
  return z.preprocess(
    toNumberOrUndefined,
    z.number({ invalid_type_error: 'Enter a valid number.' }).min(0, { message: 'Can\'t be negative.' }).optional(),
  )
}

/** A required, non-negative amount. */
export function requiredAmount(message = 'Amount is required.') {
  return z.preprocess(
    toNumberOrUndefined,
    z.number({ required_error: message, invalid_type_error: 'Enter a valid number.' }).min(0, { message: 'Can\'t be negative.' }),
  )
}
