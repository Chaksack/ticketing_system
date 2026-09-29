/**
 * One row per decision on a lead or tender — `deal_id`, `outcome` ('Won' | 'Lost'), `decided_at` —
 * for use as a subquery: `FROM (${dealDecisionsSql('lead')}) AS decisions`.
 *
 * A deal counts as won the first time it's either moved to Won *or* converted into a client.
 * "Convert to Client" sets stage = 'won' but only logs a 'converted' activity (no stage change),
 * so looking at stage changes alone silently misses every deal won that way.
 */
export function dealDecisionsSql(kind: 'lead' | 'tender') {
  const activityTable = `${kind}_activity`
  const dealColumn = `${kind}_id`
  return `
    SELECT ${dealColumn} AS deal_id, 'Won' AS outcome, MIN(created_at) AS decided_at
    FROM ${activityTable}
    WHERE (type = 'stage_changed' AND to_value = 'Won') OR type = 'converted'
    GROUP BY ${dealColumn}
    UNION ALL
    SELECT ${dealColumn} AS deal_id, 'Lost' AS outcome, created_at AS decided_at
    FROM ${activityTable}
    WHERE type = 'stage_changed' AND to_value = 'Lost'
  `
}
