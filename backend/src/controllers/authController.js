import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { get, run, all } from "../config/database.js"
import crypto from "crypto"

export async function register(req, res) {
  try {
    const { name, email, password, adminKey } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Nome, email e senha são obrigatórios" })
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "A senha deve ter no mínimo 8 caracteres" })
    }

    const existingUser = get(
      "SELECT id FROM users WHERE email = ?",
      [email.trim().toLowerCase()]
    )

    if (existingUser) {
      return res.status(400).json({ error: "Este e-mail já está cadastrado" })
    }

    let role = "user"

    if (adminKey && adminKey === process.env.ADMIN_KEY) {
      role = "admin"
    }

    const password_hash = await bcrypt.hash(password, 10)
    const result = run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), password_hash, role]
    )

    const user = get(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [Number(result.lastInsertRowid)]
    )

    return res.status(201).json(user)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha são obrigatórios" })
    }

    const user = get(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email.trim().toLowerCase()]
    )

    if (!user) {
      return res.status(400).json({ error: "Usuário não encontrado" })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)

    if (!validPassword) {
      return res.status(401).json({ error: "Senha inválida" })
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    )

    // Gerar refresh token
    const refreshToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 dias

    run(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, refreshToken, expiresAt]
    )

    return res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function me(req, res) {
  try {
    const user = get(
      "SELECT id, name, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    )

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    return res.json(user)
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}

export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token é obrigatório" })
    }

    const tokenRecord = get(
      "SELECT * FROM refresh_tokens WHERE token = ?",
      [refreshToken]
    )

    if (!tokenRecord) {
      return res.status(401).json({ error: "Refresh token inválido" })
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      run("DELETE FROM refresh_tokens WHERE id = ?", [tokenRecord.id])
      return res.status(401).json({ error: "Refresh token expirado" })
    }

    const user = get(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [tokenRecord.user_id]
    )

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" })
    }

    const newToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    )

    return res.json({
      token: newToken,
      refreshToken,
      user
    })
  } catch (error) {
    return res.status(500).json({ error: error.message })
  }
}
