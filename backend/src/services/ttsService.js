import fs from "fs"
import os from "os"
import path from "path"
import { execFile } from "child_process"
import { promisify } from "util"
import { fileURLToPath } from "url"
import {
  DEFAULT_TTS_LANG_CODE,
  DEFAULT_TTS_VOICE,
  resolveVoiceSelection
} from "./ttsVoices.js"

const execFileAsync = promisify(execFile)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, "../..")

function getOutputDir() {
  return path.join(backendRoot, "audio")
}

function getTempDir() {
  return path.join(os.tmpdir(), "ai-audiobook-kokoro")
}

function getPythonBinary() {
  return process.env.KOKORO_PYTHON_BIN || "python"
}

function getPythonScriptPath() {
  return path.resolve(
    backendRoot,
    process.env.KOKORO_PYTHON_SCRIPT || path.join("scripts", "kokoro_tts.py")
  )
}

function chunkText(text, maxLength = 450) {
  const normalized = String(text || "").replace(/\r/g, "").trim()

  if (!normalized) {
    return []
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean)

  const chunks = []
  let current = ""

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph

    if (next.length <= maxLength) {
      current = next
      continue
    }

    if (current) {
      chunks.push(current)
      current = ""
    }

    if (paragraph.length <= maxLength) {
      current = paragraph
      continue
    }

    const sentences = paragraph
      .split(/(?<=[.!?;:])\s+/)
      .map((item) => item.trim())
      .filter(Boolean)

    let sentenceBuffer = ""

    for (const sentence of sentences) {
      const sentenceNext = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence

      if (sentenceNext.length <= maxLength) {
        sentenceBuffer = sentenceNext
      } else {
        if (sentenceBuffer) {
          chunks.push(sentenceBuffer)
        }
        sentenceBuffer = sentence
      }
    }

    if (sentenceBuffer) {
      current = sentenceBuffer
    }
  }

  if (current) {
    chunks.push(current)
  }

  return chunks
}

async function runPythonTts({ inputFilePath, outputFilePath, voice, langCode }) {
  const pythonBinary = getPythonBinary()
  const scriptPath = getPythonScriptPath()
  const args = [
    scriptPath,
    "--text-file",
    inputFilePath,
    "--output",
    outputFilePath,
    "--voice",
    voice || DEFAULT_TTS_VOICE,
    "--lang-code",
    langCode || DEFAULT_TTS_LANG_CODE
  ]

  try {
    await execFileAsync(pythonBinary, args, {
      cwd: backendRoot,
      maxBuffer: 10 * 1024 * 1024
    })
  } catch (error) {
    const stderr = error?.stderr?.trim()
    const stdout = error?.stdout?.trim()
    const details = stderr || stdout || error.message
    throw new Error(details)
  }
}

export async function generateAudio(text, fileName, options = {}) {
  const chunks = chunkText(text)

  if (chunks.length === 0) {
    throw new Error("Texto vazio para geracao de audio")
  }

  const outputDir = getOutputDir()
  const tempDir = getTempDir()
  fs.mkdirSync(outputDir, { recursive: true })
  fs.mkdirSync(tempDir, { recursive: true })

  const resolvedVoice = resolveVoiceSelection(options.voice)
  const langCode = options.langCode || resolvedVoice.langCode || DEFAULT_TTS_LANG_CODE
  const voice = resolvedVoice.voice || DEFAULT_TTS_VOICE

  const inputFilePath = path.join(tempDir, `${fileName}.txt`)
  const outputFilePath = path.join(outputDir, `${fileName}.wav`)

  try {
    fs.writeFileSync(inputFilePath, chunks.join("\n\n"), "utf8")

    await runPythonTts({
      inputFilePath,
      outputFilePath,
      voice,
      langCode
    })

    return outputFilePath
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Falha ao gerar audio com Kokoro-82M pt-BR: ${message}`)
  } finally {
    if (fs.existsSync(inputFilePath)) {
      fs.unlinkSync(inputFilePath)
    }
  }
}
