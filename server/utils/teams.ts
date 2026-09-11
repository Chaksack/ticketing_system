export async function getTeamStaffIds(managerId: string): Promise<string[]> {
  const db = useDatabase()
  const rows = await db.prepare('SELECT id FROM staff WHERE manager_id = ?').all(managerId) as { id: string }[]
  return [managerId, ...rows.map(row => row.id)]
}
