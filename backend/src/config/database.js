import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { DatabaseSync } from "node:sqlite"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDirectory = path.resolve(__dirname, "../../data")
const databasePath = path.join(dataDirectory, "audiobook.sqlite")

fs.mkdirSync(dataDirectory, { recursive: true })

const db = new DatabaseSync(databasePath)
db.exec("PRAGMA foreign_keys = ON;")

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function ensureColumn(tableName, columnName, definition) {
  if (!hasColumn(tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`)
  }
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audiobooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      original_pdf TEXT,
      status TEXT NOT NULL DEFAULT 'enviado' CHECK(status IN ('enviado', 'processando', 'pronto', 'falhou', 'necessita_ocr')),
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audiobook_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      audio_url TEXT,
      audio_path TEXT,
      duration INTEGER,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audiobook_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT,
      duration INTEGER,
      order_index INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      audiobook_id INTEGER NOT NULL,
      granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, audiobook_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS processing_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audiobook_id INTEGER,
      level TEXT NOT NULL DEFAULT 'error',
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (audiobook_id) REFERENCES audiobooks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_chapters_audiobook_id ON chapters(audiobook_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_audiobook_id ON tracks(audiobook_id);
    CREATE INDEX IF NOT EXISTS idx_permissions_user_id ON permissions(user_id);
    CREATE INDEX IF NOT EXISTS idx_permissions_audiobook_id ON permissions(audiobook_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  `)

  ensureColumn("audiobooks", "tts_voice", "TEXT NOT NULL DEFAULT 'pf_dora'")
  ensureColumn("audiobooks", "tts_lang_code", "TEXT NOT NULL DEFAULT 'p'")
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...params)
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...params) ?? null
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...params)
}

export function transaction(callback) {
  db.exec("BEGIN")

  try {
    const result = callback()
    db.exec("COMMIT")
    return result
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  }
}

export function logProcessingError(audiobookId, message) {
  run(
    "INSERT INTO processing_logs (audiobook_id, level, message) VALUES (?, 'error', ?)",
    [audiobookId ?? null, message]
  )
}

export function logProcessingEvent(audiobookId, level, message) {
  run(
    "INSERT INTO processing_logs (audiobook_id, level, message) VALUES (?, ?, ?)",
    [audiobookId ?? null, level || "info", message]
  )
}

export { databasePath }
