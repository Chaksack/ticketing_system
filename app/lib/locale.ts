/**
 * The one locale every date and number in the UI is formatted with. Using the visitor's locale
 * ("undefined") made server-rendered text differ from the browser's (e.g. "Sep" vs "Sept"),
 * which breaks hydration; a fixed locale keeps them identical. en-GB matches how dates are
 * written in Ghana (21 October 2026, 24-hour friendly).
 */
export const APP_LOCALE = 'en-GB'
