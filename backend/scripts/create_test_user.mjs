import bcrypt from "bcrypt"
import { get, run } from "../src/config/database.js"

async function main() {
  const name = "Test User"
  const email = "test@example.com"
  const password = "password123"

  const existing = get("SELECT id FROM users WHERE email = ?", [email])

  if (existing) {
    console.log("User already exists:", existing)
    return
  }

  const password_hash = await bcrypt.hash(password, 10)

  const result = run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, email, password_hash, "user"]
  )

  const user = get("SELECT id, name, email, role FROM users WHERE id = ?", [Number(result.lastInsertRowid)])
  console.log("Created user:", user)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
