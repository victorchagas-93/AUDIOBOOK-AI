import { all } from "../config/database.js"

export async function listProcessingLogs(req, res) {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem visualizar logs" })
    }

    const logs = all(`
      SELECT
        l.id,
        l.level,
        l.message,
        l.created_at,
        a.id AS audiobook_id,
        a.title AS audiobook_title
      FROM processing_logs l
      LEFT JOIN audiobooks a ON a.id = l.audiobook_id
      ORDER BY l.created_at DESC
      LIMIT 100
    `)

    return res.json(logs)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
