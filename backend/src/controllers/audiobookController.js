import fs from "fs"
import path from "path"
import { all, get, run } from "../config/database.js"
import { createMergedAlbum } from "../services/wavAlbumService.js"
import {
  DEFAULT_TTS_LANG_CODE,
  DEFAULT_TTS_VOICE,
  listVoiceOptions,
  resolveVoiceSelection
} from "../services/ttsVoices.js"

function toErrorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

function canAccessAudiobook(user, audiobookId) {
  if (user.role === "admin") {
    return true
  }

  const permission = get(
    "SELECT id FROM permissions WHERE user_id = ? AND audiobook_id = ?",
    [user.id, audiobookId]
  )

  return Boolean(permission)
}

function getAlbumTrack(audiobookId) {
  return get(
    "SELECT * FROM tracks WHERE audiobook_id = ? ORDER BY order_index ASC LIMIT 1",
    [audiobookId]
  )
}

function getAudioContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  return extension === ".wav" ? "audio/wav" : "audio/mpeg"
}

export async function createAudiobook(req, res) {
  try {
    const { title, description, ttsVoice } = req.body
    const user = req.user

    if (!title) {
      return res.status(400).json({ error: "O titulo do audiobook e obrigatorio" })
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem criar audiobooks" })
    }

    const voiceSelection = resolveVoiceSelection(ttsVoice)

    const result = run(
      `
        INSERT INTO audiobooks (title, description, created_by, status, tts_voice, tts_lang_code)
        VALUES (?, ?, ?, 'enviado', ?, ?)
      `,
      [title.trim(), description?.trim() || null, user.id, voiceSelection.voice, voiceSelection.langCode]
    )

    const audiobook = get("SELECT * FROM audiobooks WHERE id = ?", [Number(result.lastInsertRowid)])
    return res.status(201).json(audiobook)
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function listTtsVoices(req, res) {
  return res.json({
    defaultVoice: DEFAULT_TTS_VOICE,
    defaultLangCode: DEFAULT_TTS_LANG_CODE,
    voices: listVoiceOptions()
  })
}

export async function listAudiobooks(req, res) {
  try {
    const { user } = req

    const sql = user.role === "admin"
      ? `
        SELECT
          a.*,
          (SELECT COUNT(*) FROM chapters c WHERE c.audiobook_id = a.id) AS chapter_count,
          (SELECT COUNT(*) FROM permissions p WHERE p.audiobook_id = a.id) AS granted_users,
          COALESCE((SELECT SUM(c.duration) FROM chapters c WHERE c.audiobook_id = a.id), 0) AS total_duration,
          EXISTS(SELECT 1 FROM tracks t WHERE t.audiobook_id = a.id) AS has_album
        FROM audiobooks a
        ORDER BY a.created_at DESC
      `
      : `
        SELECT
          a.*,
          (SELECT COUNT(*) FROM chapters c WHERE c.audiobook_id = a.id) AS chapter_count,
          (SELECT COUNT(*) FROM permissions p2 WHERE p2.audiobook_id = a.id) AS granted_users,
          COALESCE((SELECT SUM(c.duration) FROM chapters c WHERE c.audiobook_id = a.id), 0) AS total_duration,
          EXISTS(SELECT 1 FROM tracks t WHERE t.audiobook_id = a.id) AS has_album
        FROM audiobooks a
        INNER JOIN permissions p ON p.audiobook_id = a.id
        WHERE p.user_id = ?
        ORDER BY a.created_at DESC
      `

    const audiobooks = user.role === "admin" ? all(sql) : all(sql, [user.id])
    return res.json(audiobooks)
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function getAudiobookDetails(req, res) {
  try {
    const audiobookId = Number(req.params.id)
    const { user } = req

    if (!Number.isFinite(audiobookId)) {
      return res.status(400).json({ error: "Id invalido" })
    }

    const audiobook = get(`
      SELECT
        a.*,
        COUNT(DISTINCT c.id) AS chapter_count,
        COALESCE(SUM(c.duration), 0) AS total_duration
      FROM audiobooks a
      LEFT JOIN chapters c ON c.audiobook_id = a.id
      WHERE a.id = ?
      GROUP BY a.id
    `, [audiobookId])

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    if (!canAccessAudiobook(user, audiobookId)) {
      return res.status(403).json({ error: "Voce nao tem acesso a este audiobook" })
    }

    const chapters = all(
      "SELECT * FROM chapters WHERE audiobook_id = ? ORDER BY order_index ASC",
      [audiobookId]
    )

    return res.json({
      ...audiobook,
      chapters,
      album_track: getAlbumTrack(audiobookId)
    })
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function deleteAudiobook(req, res) {
  try {
    const { id } = req.params
    const user = req.user

    if (!id) {
      return res.status(400).json({ error: "Id do audiobook e obrigatorio" })
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem deletar" })
    }

    const audiobook = get("SELECT id FROM audiobooks WHERE id = ?", [Number(id)])
    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    run("DELETE FROM audiobooks WHERE id = ?", [Number(id)])
    return res.json({ message: "Audiobook deletado com sucesso" })
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function updateAudiobookTtsSettings(req, res) {
  try {
    const audiobookId = Number(req.params.id)
    const user = req.user
    const { ttsVoice } = req.body

    if (!Number.isFinite(audiobookId)) {
      return res.status(400).json({ error: "Id invalido" })
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem alterar a voz base" })
    }

    const audiobook = get("SELECT id FROM audiobooks WHERE id = ?", [audiobookId])
    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    const voiceSelection = resolveVoiceSelection(ttsVoice)

    run(
      "UPDATE audiobooks SET tts_voice = ?, tts_lang_code = ? WHERE id = ?",
      [voiceSelection.voice, voiceSelection.langCode, audiobookId]
    )

    run(
      "UPDATE chapters SET audio_path = NULL, audio_url = NULL, duration = NULL WHERE audiobook_id = ?",
      [audiobookId]
    )

    run("UPDATE audiobooks SET status = 'processando' WHERE id = ?", [audiobookId])
    run("DELETE FROM tracks WHERE audiobook_id = ?", [audiobookId])

    return res.json({
      message: "Voz base atualizada com sucesso",
      data: get("SELECT * FROM audiobooks WHERE id = ?", [audiobookId])
    })
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function getProcessingStatus(req, res) {
  try {
    const audiobookId = Number(req.params.id)
    const { user } = req

    if (!Number.isFinite(audiobookId)) {
      return res.status(400).json({ error: "Id invalido" })
    }

    const audiobook = get(
      "SELECT id, title, status FROM audiobooks WHERE id = ?",
      [audiobookId]
    )

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    if (!canAccessAudiobook(user, audiobookId)) {
      return res.status(403).json({ error: "Voce nao tem acesso a este audiobook" })
    }

    const chapters = all(
      "SELECT id, title, audio_url, audio_path FROM chapters WHERE audiobook_id = ?",
      [audiobookId]
    )

    const totalChapters = chapters.length
    const completedChapters = chapters.filter((chapter) => chapter.audio_url || chapter.audio_path).length
    const progress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0

    const logs = all(
      "SELECT level, message, created_at FROM processing_logs WHERE audiobook_id = ? ORDER BY created_at DESC LIMIT 5",
      [audiobookId]
    )

    return res.json({
      id: audiobook.id,
      title: audiobook.title,
      status: audiobook.status,
      progress,
      totalChapters,
      completedChapters,
      logs,
      hasAlbum: Boolean(getAlbumTrack(audiobookId))
    })
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function generateAudiobookAlbum(req, res) {
  try {
    const audiobookId = Number(req.params.id)
    const { user } = req

    if (!Number.isFinite(audiobookId)) {
      return res.status(400).json({ error: "Id invalido" })
    }

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem gerar o album completo" })
    }

    const audiobook = get("SELECT id, title FROM audiobooks WHERE id = ?", [audiobookId])
    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    const chapters = all(
      "SELECT id, title, audio_path, duration, order_index FROM chapters WHERE audiobook_id = ? ORDER BY order_index ASC",
      [audiobookId]
    )

    if (chapters.length === 0) {
      return res.status(400).json({ error: "O audiobook ainda nao possui faixas para montar o album" })
    }

    const missingAudio = chapters.find((chapter) => !chapter.audio_path || !fs.existsSync(chapter.audio_path))
    if (missingAudio) {
      return res.status(400).json({ error: `A faixa ${missingAudio.order_index} ainda nao possui audio pronto` })
    }

    const albumDir = path.join(process.cwd(), "audio", "albums")
    const albumPath = path.join(albumDir, `audiobook-${audiobookId}-album.wav`)
    createMergedAlbum(chapters.map((chapter) => chapter.audio_path), albumPath)

    const duration = chapters.reduce((sum, chapter) => sum + (Number(chapter.duration) || 0), 0)
    const existingTrack = getAlbumTrack(audiobookId)

    if (existingTrack) {
      run(
        "UPDATE tracks SET title = ?, file_path = ?, duration = ?, order_index = 1 WHERE id = ?",
        ["Album completo", albumPath, duration, existingTrack.id]
      )
    } else {
      run(
        "INSERT INTO tracks (audiobook_id, title, file_path, duration, order_index) VALUES (?, ?, ?, ?, 1)",
        [audiobookId, "Album completo", albumPath, duration]
      )
    }

    return res.json({
      message: "Album completo gerado com sucesso",
      data: getAlbumTrack(audiobookId)
    })
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}

export async function streamAudiobookAlbum(req, res) {
  try {
    const audiobookId = Number(req.params.id)
    const { user } = req

    if (!Number.isFinite(audiobookId)) {
      return res.status(400).json({ error: "Id invalido" })
    }

    const audiobook = get("SELECT id FROM audiobooks WHERE id = ?", [audiobookId])
    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    if (!canAccessAudiobook(user, audiobookId)) {
      return res.status(403).json({ error: "Voce nao tem acesso a este audiobook" })
    }

    const albumTrack = getAlbumTrack(audiobookId)
    if (!albumTrack?.file_path || !fs.existsSync(albumTrack.file_path)) {
      return res.status(404).json({ error: "O album completo ainda nao foi gerado" })
    }

    res.setHeader("Content-Type", getAudioContentType(albumTrack.file_path))
    res.setHeader("Cache-Control", "no-store")
    fs.createReadStream(albumTrack.file_path).pipe(res)
  } catch (error) {
    return res.status(500).json({ error: toErrorMessage(error) })
  }
}
