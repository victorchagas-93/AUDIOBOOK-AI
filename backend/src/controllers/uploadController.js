import multer from "multer"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { PDFParse } from "pdf-parse"
import { get, logProcessingError, logProcessingEvent, run, transaction } from "../config/database.js"
import { processScannedPDF, isScannedPDF } from "../services/ocrService.js"

class OCRRequiredError extends Error {
  constructor(message) {
    super(message)
    this.name = "OCRRequiredError"
  }
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadDirectory = path.resolve(__dirname, "../../uploads")

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
})

export const uploadMiddleware = upload.array("files", 10)

fs.mkdirSync(uploadDirectory, { recursive: true })

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function chunkText(text, maxLength = 5000) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const chunks = []
  let current = ""

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph

    if (candidate.length > maxLength && current) {
      chunks.push(current)
      current = paragraph
    } else {
      current = candidate
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

function splitIntoChapters(text) {
  const normalized = normalizeText(text)

  if (!normalized) {
    return []
  }

  const headingRegex = /(?:^|\n)\s*(cap[ií]tulo|chapter)\s+([^\n]*)/gim
  const matches = [...normalized.matchAll(headingRegex)]

  if (matches.length === 0) {
    return chunkText(normalized).map((content, index) => ({
      title: `Capitulo ${index + 1}`,
      content
    }))
  }

  const chapters = matches.map((match, index) => {
    const start = match.index + match[0].length
    const end = index + 1 < matches.length ? matches[index + 1].index : normalized.length
    const suffix = match[2]?.trim()
    const content = normalizeText(normalized.slice(start, end))

    return {
      title: suffix ? `${match[1]} ${suffix}`.trim() : `Capitulo ${index + 1}`,
      content
    }
  }).filter((chapter) => chapter.content)

  if (chapters.length > 0) {
    return chapters
  }

  return [{ title: "Capitulo 1", content: normalized }]
}

async function extractTextFromFile(file) {
  const parser = new PDFParse({ data: file.buffer })

  try {
    const result = await parser.getText()
    const directText = (result.text || "").trim()

    if (directText.length > 50) {
      console.log("PDF com texto detectado. Usando extracao direta.")
      return directText
    }

    console.log("Possivel PDF escaneado detectado. Tentando OCR...")

    let scanned = false

    try {
      scanned = await isScannedPDF(file.buffer)

      if (!scanned) {
        return directText
      }

      console.log("PDF escaneado confirmado. Executando OCR...")
      const ocrResult = await processScannedPDF(file.buffer)
      const ocrText = ocrResult.text?.trim()

      if (ocrText) {
        console.log("OCR completado com sucesso.")
        return ocrText
      }

      throw new OCRRequiredError(`OCR nao conseguiu extrair texto de ${file.originalname}`)
    } catch (ocrError) {
      if (ocrError instanceof OCRRequiredError) {
        throw ocrError
      }

      if (scanned) {
        throw new OCRRequiredError(`OCR falhou para ${file.originalname}: ${ocrError.message}`)
      }

      console.log("OCR falhou, usando extracao direta como fallback.")
      logProcessingError(null, `OCR falhou: ${ocrError.message}`)
    }

    return directText
  } catch (error) {
    console.error("Erro ao extrair texto:", error)
    logProcessingError(null, `Erro na extracao de texto: ${error.message}`)
    throw error
  } finally {
    await parser.destroy().catch(() => {})
  }
}

function buildStoredFileName(file) {
  const extension = path.extname(file.originalname) || ".pdf"

  const safeBaseName = file.originalname
    .replace(extension, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBaseName || "arquivo"}${extension}`
}

export async function uploadFile(req, res) {
  try {
    const { audiobook_id: audiobookId } = req.body
    const user = req.user

    if (user.role !== "admin") {
      return res.status(403).json({ error: "Apenas admins podem processar uploads" })
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Envie pelo menos um arquivo PDF" })
    }

    if (!audiobookId) {
      return res.status(400).json({ error: "audiobook_id e obrigatorio" })
    }

    const audiobook = get("SELECT * FROM audiobooks WHERE id = ?", [Number(audiobookId)])

    if (!audiobook) {
      return res.status(404).json({ error: "Audiobook nao encontrado" })
    }

    const invalidFile = req.files.find((file) => file.mimetype !== "application/pdf")

    if (invalidFile) {
      return res.status(400).json({ error: "Envie apenas arquivos PDF" })
    }

    run(
      "UPDATE audiobooks SET status = 'processando' WHERE id = ?",
      [Number(audiobookId)]
    )
    logProcessingEvent(Number(audiobookId), "info", `Upload iniciado com ${req.files.length} arquivo(s)`)

    const processedFiles = []
    const chapterRows = []
    let nextOrder = 1

    for (const file of req.files) {
      const storedFileName = buildStoredFileName(file)
      const relativeFilePath = path.join("uploads", storedFileName)
      const absoluteFilePath = path.join(uploadDirectory, storedFileName)

      fs.writeFileSync(absoluteFilePath, file.buffer)

      logProcessingEvent(Number(audiobookId), "info", `Extraindo texto de ${file.originalname}`)
      const extractedText = await extractTextFromFile(file)
      const chapters = splitIntoChapters(extractedText)

      if (chapters.length === 0) {
        throw new Error(`Nao foi possivel extrair texto do arquivo ${file.originalname}`)
      }

      processedFiles.push({
        name: file.originalname,
        stored_as: relativeFilePath,
        size: file.size,
        extracted_characters: extractedText.length
      })

      for (const chapter of chapters) {
        chapterRows.push({
          title: req.files.length > 1
            ? `${chapter.title} - ${file.originalname}`
            : chapter.title,
          content: chapter.content,
          order_index: nextOrder
        })
        nextOrder += 1
      }
    }

    const persistedChapters = transaction(() => {
      const insertedChapters = []

      run("DELETE FROM chapters WHERE audiobook_id = ?", [Number(audiobookId)])
      run(
        "UPDATE audiobooks SET original_pdf = ?, status = 'processando' WHERE id = ?",
        [processedFiles.map((file) => file.stored_as).join(","), Number(audiobookId)]
      )

      for (const chapterRow of chapterRows) {
        const result = run(
          "INSERT INTO chapters (audiobook_id, title, content, order_index) VALUES (?, ?, ?, ?)",
          [Number(audiobookId), chapterRow.title, chapterRow.content, chapterRow.order_index]
        )

        insertedChapters.push(
          get("SELECT * FROM chapters WHERE id = ?", [Number(result.lastInsertRowid)])
        )
      }

      return insertedChapters
    })

    logProcessingEvent(
      Number(audiobookId),
      "success",
      `Upload concluido: ${persistedChapters.length} capitulo(s) extraido(s)`
    )

    return res.status(201).json({
      message: "Upload processado com sucesso",
      files: processedFiles,
      chapters: persistedChapters
    })
  } catch (error) {
    console.error("Erro no upload:", error)
    const audiobookId = Number(req.body?.audiobook_id)

    if (Number.isFinite(audiobookId)) {
      try {
        const nextStatus = error instanceof OCRRequiredError ? "necessita_ocr" : "falhou"
        run("UPDATE audiobooks SET status = ? WHERE id = ?", [nextStatus, audiobookId])
        logProcessingError(audiobookId, error.message)
      } catch (loggingError) {
        console.error("Erro ao registrar falha de processamento:", loggingError)
      }
    }

    const statusCode = error instanceof OCRRequiredError ? 422 : 500
    return res.status(statusCode).json({ error: error.message })
  }
}
