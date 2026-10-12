/**
 * $fetch without Nitro's typed-route inference. With this many API routes, inferring the response
 * type for a dynamic URL like `/api/${entity}/…` recurses past TypeScript's depth limit ("Type
 * instantiation is excessively deep"), so those calls state their response type explicitly instead.
 */
export const fetchUntyped = $fetch as <T>(url: string, options?: { method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', query?: Record<string, unknown>, body?: unknown }) => Promise<T>
