import fs from "fs"
import crypto from "crypto"
import path from "path"
import { generateAudio as generateAudioFile } from "../services/ttsService.js"
import { all, get, logProcessingEvent, run } from "../config/database.js"

function safeDownloadName(value) {
  return String(value || "audio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "audio"
}

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function getAudioContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === ".wav") {
    return "audio/wav"
  }

  return "audio/mpeg"
}

function ensureChapterAccess(req, chapter) {
  if (req.user.role === "admin") {
    return true
  }

  const permission = get(
    "SELECT id FROM permissions WHERE user_id = ? AND audiobook_id = ?",
    [req.user.id, chapter.audiobook_id]
  )

  return Boolean(permission)
}

export async function createChapter(req, res) {
  try {
    const { audiobook_id, title, content, order_index } = req.body
    const user = req.user

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem criar capítulos" })
    }

    const result = run(
      "INSERT INTO chapters (audiobook_id, title, content, order_index) VALUES (?, ?, ?, ?)",
      [audiobook_id, title, content ?? null, order_index]
    )

    const chapter = get("SELECT * FROM chapters WHERE id = ?", [Number(result.lastInsertRowid)])

    res.json(chapter)
  } catch (error) {
    res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function listChapters(req, res) {
  try {
    const { audiobook_id } = req.params
    const { user } = req

    if (user.role !== "admin") {
      const hasPermission = get(
        "SELECT 1 FROM permissions WHERE user_id = ? AND audiobook_id = ? LIMIT 1",
        [user.id, Number(audiobook_id)]
      )

      if (!hasPermission) {
        return res.status(403).json({ error: "Você não tem acesso a este audiobook" })
      }
    }

    const data = all(
      "SELECT * FROM chapters WHERE audiobook_id = ? ORDER BY order_index ASC",
      [Number(audiobook_id)]
    )

    res.json(data)
  } catch (error) {
    res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function generateAudio(req, res) {
  try {
    const { id } = req.params
    const user = req.user

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem gerar áudio" })
    }

    const chapter = get("SELECT * FROM chapters WHERE id = ?", [Number(id)])

    if (!chapter) {
      return res.status(404).json({ error: "Capítulo não encontrado" })
    }

    if (!chapter.content) {
      return res.status(400).json({ error: "O capítulo não possui conteúdo para conversão" })
    }

    const audiobook = get(
      "SELECT id, tts_voice, tts_lang_code FROM audiobooks WHERE id = ?",
      [chapter.audiobook_id]
    )

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nÃ£o encontrado" })
    }

    const fileName = `audiobook-${chapter.audiobook_id}-chapter-${chapter.order_index}`
    const filePath = await generateAudioFile(chapter.content, fileName, {
      voice: audiobook.tts_voice,
      langCode: audiobook.tts_lang_code
    })
    const estimatedDuration = Math.max(10, Math.ceil(chapter.content.length / 15))

    run(
      "UPDATE chapters SET audio_path = ?, audio_url = NULL, duration = ? WHERE id = ?",
      [filePath, estimatedDuration, Number(id)]
    )

    run("DELETE FROM tracks WHERE audiobook_id = ?", [chapter.audiobook_id])

    const progress = get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN audio_path IS NOT NULL OR audio_url IS NOT NULL THEN 1 ELSE 0 END) AS completed
      FROM chapters
      WHERE audiobook_id = ?
    `, [chapter.audiobook_id])

    const isReady = Number(progress.completed) >= Number(progress.total)

    run(
      "UPDATE audiobooks SET status = ? WHERE id = ?",
      [isReady ? "pronto" : "processando", chapter.audiobook_id]
    )

    logProcessingEvent(
      chapter.audiobook_id,
      isReady ? "success" : "info",
      `Audio gerado para ${chapter.title} (${progress.completed}/${progress.total})`
    )

    const updatedChapter = get("SELECT * FROM chapters WHERE id = ?", [Number(id)])

    res.json({
      message: "Áudio gerado com sucesso",
      data: updatedChapter
    })
  } catch (error) {
    res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function streamChapterAudio(req, res) {
  try {
    const chapterId = Number(req.params.id)
    const chapter = get("SELECT * FROM chapters WHERE id = ?", [chapterId])

    if (!chapter) {
      return res.status(404).json({ error: "Capítulo não encontrado" })
    }

    if (req.user.role !== "admin") {
      const permission = get(
        "SELECT id FROM permissions WHERE user_id = ? AND audiobook_id = ?",
        [req.user.id, chapter.audiobook_id]
      )

      if (!permission) {
        return res.status(403).json({ error: "Você não tem permissão para ouvir este áudio" })
      }
    }

    if (!chapter.audio_path || !fs.existsSync(chapter.audio_path)) {
      return res.status(404).json({ error: "Áudio ainda não foi gerado para este capítulo" })
    }

    res.setHeader("Content-Type", getAudioContentType(chapter.audio_path))
    res.setHeader("Cache-Control", "no-store")

    fs.createReadStream(chapter.audio_path).pipe(res)
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function downloadEncryptedChapterAudio(req, res) {
  try {
    const chapterId = Number(req.params.id)
    const chapter = get("SELECT * FROM chapters WHERE id = ?", [chapterId])

    if (!chapter) {
      return res.status(404).json({ error: "Capitulo nao encontrado" })
    }

    if (!ensureChapterAccess(req, chapter)) {
      return res.status(403).json({ error: "Voce nao tem permissao para baixar este audio" })
    }

    if (!chapter.audio_path || !fs.existsSync(chapter.audio_path)) {
      return res.status(404).json({ error: "Audio ainda nao foi gerado para este capitulo" })
    }

    const secret = process.env.DOWNLOAD_SECRET || process.env.JWT_SECRET

    if (!secret) {
      return res.status(500).json({ error: "DOWNLOAD_SECRET ou JWT_SECRET nao configurado" })
    }

    const audioBuffer = fs.readFileSync(chapter.audio_path)
    const salt = crypto.randomBytes(16)
    const iv = crypto.randomBytes(12)
    const key = crypto.scryptSync(secret, salt, 32)
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const encrypted = Buffer.concat([cipher.update(audioBuffer), cipher.final()])
    const authTag = cipher.getAuthTag()
    const baseName = safeDownloadName(`${chapter.title}-${chapter.id}`)

    const payload = {
      algorithm: "aes-256-gcm",
      keyDerivation: "scrypt",
      encryptedAt: new Date().toISOString(),
      chapter: {
        id: chapter.id,
        audiobook_id: chapter.audiobook_id,
        title: chapter.title,
        duration: chapter.duration
      },
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: encrypted.toString("base64")
    }

    logProcessingEvent(
      chapter.audiobook_id,
      "info",
      `Download criptografado gerado para ${chapter.title}`
    )

    res.setHeader("Content-Type", "application/json")
    res.setHeader("Cache-Control", "no-store")
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.encrypted.json"`)

    return res.json(payload)
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}
