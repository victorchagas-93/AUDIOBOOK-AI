import bcrypt from "bcrypt"
import { get, run } from "../src/config/database.js"

async function main() {
  const name = "Admin User"
  const email = "admin@example.com"
  const password = "adminpassword"
  const existing = get("SELECT id FROM users WHERE email = ?", [email])

  if (existing) {
    console.log("Admin already exists:", existing)
    return
  }

  const password_hash = await bcrypt.hash(password, 10)

  const result = run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, email, password_hash, "admin"]
  )

  const user = get("SELECT id, name, email, role FROM users WHERE id = ?", [Number(result.lastInsertRowid)])
  console.log("Created admin user:", user)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
