import bcrypt from "bcrypt"
import { run, get, all } from "../config/database.js"
import fs from "fs"
import path from "path"

const admins = [
  { name: "Marina Souza", email: "admin1@example.com", password: "senha123" },
  { name: "Rafael Lima", email: "admin2@example.com", password: "senha123" },
  { name: "Camila Rocha", email: "admin3@example.com", password: "senha123" },
  { name: "Eduardo Martins", email: "admin4@example.com", password: "senha123" },
  { name: "Patricia Alves", email: "admin5@example.com", password: "senha123" },
]

const users = [
  { name: "Joao Pedro", email: "user1@example.com", password: "senha123" },
  { name: "Gabriel Santos", email: "user2@example.com", password: "senha123" },
  { name: "Pedro Henrique", email: "user3@example.com", password: "senha123" },
  { name: "Lucas Oliveira", email: "user4@example.com", password: "senha123" },
  { name: "Ana Clara", email: "user5@example.com", password: "senha123" },
]

const audiobooks = [
  { title: "Audiobook Fictício 1", description: "Descrição do Audiobook 1" },
  { title: "Audiobook Fictício 2", description: "Descrição do Audiobook 2" },
  { title: "Audiobook Fictício 3", description: "Descrição do Audiobook 3" },
  { title: "Audiobook Fictício 4", description: "Descrição do Audiobook 4" },
  { title: "Audiobook Fictício 5", description: "Descrição do Audiobook 5" },
]

const chapters = [
  { title: "Capítulo 1", content: "Conteúdo do capítulo 1." },
  { title: "Capítulo 2", content: "Conteúdo do capítulo 2." },
  { title: "Capítulo 3", content: "Conteúdo do capítulo 3." },
]

const logs = [
  { level: "info", message: "Processamento iniciado." },
  { level: "info", message: "Extração de texto concluída." },
  { level: "info", message: "Geração de áudio concluída." },
  { level: "error", message: "Falha ao processar PDF." },
  { level: "info", message: "Permissão concedida." },
]

async function seed() {
  // Seed admins
  for (const admin of admins) {
    const hash = await bcrypt.hash(admin.password, 10)
    run(
      "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      [admin.name, admin.email, hash]
    )
    run("UPDATE users SET name = ? WHERE email = ?", [admin.name, admin.email])
  }
  // Seed users
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, 10)
    run(
      "INSERT OR IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
      [user.name, user.email, hash]
    )
    run("UPDATE users SET name = ? WHERE email = ?", [user.name, user.email])
  }
  // Seed audiobooks
  const adminIds = all("SELECT id FROM users WHERE role = 'admin'")
  let i = 0
  for (const ab of audiobooks) {
    const adminId = adminIds[i % adminIds.length].id
    run(
      "INSERT OR IGNORE INTO audiobooks (title, description, created_by, status) VALUES (?, ?, ?, 'pronto')",
      [ab.title, ab.description, adminId]
    )
    i++
  }
  // Seed chapters
  const abIds = all("SELECT id FROM audiobooks")
  for (const ab of abIds) {
    for (let j = 0; j < chapters.length; j++) {
      const ch = chapters[j]
      // Simular áudio real: criar arquivo mp3 placeholder
      const audioDir = path.resolve("audio")
      if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true })
      const audioPath = path.join(audioDir, `ab${ab.id}_ch${j + 1}.mp3`)
      if (!fs.existsSync(audioPath)) fs.writeFileSync(audioPath, Buffer.from([0x49,0x44,0x33])) // ID3 header
      run(
        "INSERT OR IGNORE INTO chapters (audiobook_id, title, content, audio_path, duration, order_index) VALUES (?, ?, ?, ?, ?, ?)",
        [ab.id, ch.title, ch.content, audioPath, 60 + j * 30, j + 1]
      )
    }
  }
  // Seed permissions (cada user tem acesso a 2 audiobooks)
  const userIds = all("SELECT id FROM users WHERE role = 'user'")
  for (let u = 0; u < userIds.length; u++) {
    for (let a = 0; a < 2; a++) {
      const abId = abIds[(u + a) % abIds.length].id
      run(
        "INSERT OR IGNORE INTO permissions (user_id, audiobook_id) VALUES (?, ?)",
        [userIds[u].id, abId]
      )
    }
  }
  // Seed logs
  for (const ab of abIds) {
    for (const log of logs) {
      run(
        "INSERT INTO processing_logs (audiobook_id, level, message) VALUES (?, ?, ?)",
        [ab.id, log.level, log.message]
      )
    }
  }
  // Seed refresh tokens (um por user)
  for (const user of userIds) {
    const token = Buffer.from(user.id + Date.now().toString()).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    run(
      "INSERT OR IGNORE INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expiresAt]
    )
  }
  console.log("Seed concluído!")
}

seed().catch(console.error)
