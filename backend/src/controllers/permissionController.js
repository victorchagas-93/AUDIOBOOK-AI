import { all, get, run } from "../config/database.js"

function ensureAdmin(user) {
  return user?.role === "admin"
}

export async function listUsers(req, res) {
  try {
    if (!ensureAdmin(req.user)) {
      return res.status(403).json({ error: "Apenas admins podem listar usuários" })
    }

    const users = all(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(p.id) AS granted_count
      FROM users u
      LEFT JOIN permissions p ON p.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)

    return res.json(users)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function listAudiobookPermissions(req, res) {
  try {
    if (!ensureAdmin(req.user)) {
      return res.status(403).json({ error: "Apenas admins podem visualizar permissões" })
    }

    const audiobookId = Number(req.params.audiobookId)
    const audiobook = get("SELECT id, title FROM audiobooks WHERE id = ?", [audiobookId])

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook não encontrado" })
    }

    const permissions = all(`
      SELECT
        p.id,
        p.granted_at,
        u.id AS user_id,
        u.name,
        u.email
      FROM permissions p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.audiobook_id = ?
      ORDER BY p.granted_at DESC
    `, [audiobookId])

    return res.json({
      audiobook,
      permissions
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function grantPermissions(req, res) {
  try {
    if (!ensureAdmin(req.user)) {
      return res.status(403).json({ error: "Apenas admins podem conceder acesso" })
    }

    const audiobookId = Number(req.body.audiobook_id)
    const userIds = Array.isArray(req.body.user_ids) ? req.body.user_ids.map(Number).filter(Number.isFinite) : []

    if (!audiobookId || userIds.length === 0) {
      return res.status(400).json({ error: "audiobook_id e user_ids são obrigatórios" })
    }

    const audiobook = get("SELECT id FROM audiobooks WHERE id = ?", [audiobookId])

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook não encontrado" })
    }

    for (const userId of userIds) {
      const user = get("SELECT id FROM users WHERE id = ?", [userId])

      if (!user) {
        return res.status(404).json({ error: `Usuário ${userId} não encontrado` })
      }

      run(
        "INSERT OR IGNORE INTO permissions (user_id, audiobook_id) VALUES (?, ?)",
        [userId, audiobookId]
      )
    }

    const updatedPermissions = all(`
      SELECT
        p.id,
        p.granted_at,
        u.id AS user_id,
        u.name,
        u.email
      FROM permissions p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.audiobook_id = ?
      ORDER BY p.granted_at DESC
    `, [audiobookId])

    return res.status(201).json({
      message: "Acessos concedidos com sucesso",
      permissions: updatedPermissions
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function revokePermission(req, res) {
  try {
    if (!ensureAdmin(req.user)) {
      return res.status(403).json({ error: "Apenas admins podem revogar acesso" })
    }

    const audiobookId = Number(req.params.audiobookId)
    const userId = Number(req.params.userId)

    const permission = get(
      "SELECT id FROM permissions WHERE audiobook_id = ? AND user_id = ?",
      [audiobookId, userId]
    )

    if (!permission) {
      return res.status(404).json({ error: "Permissão não encontrada" })
    }

    run(
      "DELETE FROM permissions WHERE audiobook_id = ? AND user_id = ?",
      [audiobookId, userId]
    )

    return res.json({ message: "Acesso revogado com sucesso" })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
