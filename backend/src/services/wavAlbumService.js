import fs from "fs"
import path from "path"

function readChunkHeader(buffer, offset) {
  return {
    id: buffer.toString("ascii", offset, offset + 4),
    size: buffer.readUInt32LE(offset + 4),
    dataOffset: offset + 8
  }
}

function parseWavFile(filePath) {
  const buffer = fs.readFileSync(filePath)

  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`Arquivo WAV invalido: ${filePath}`)
  }

  let offset = 12
  let format = null
  let dataChunk = null

  while (offset + 8 <= buffer.length) {
    const chunk = readChunkHeader(buffer, offset)

    if (chunk.id === "fmt ") {
      format = {
        audioFormat: buffer.readUInt16LE(chunk.dataOffset),
        channels: buffer.readUInt16LE(chunk.dataOffset + 2),
        sampleRate: buffer.readUInt32LE(chunk.dataOffset + 4),
        byteRate: buffer.readUInt32LE(chunk.dataOffset + 8),
        blockAlign: buffer.readUInt16LE(chunk.dataOffset + 12),
        bitsPerSample: buffer.readUInt16LE(chunk.dataOffset + 14)
      }
    }

    if (chunk.id === "data") {
      dataChunk = buffer.subarray(chunk.dataOffset, chunk.dataOffset + chunk.size)
    }

    offset = chunk.dataOffset + chunk.size + (chunk.size % 2)
  }

  if (!format || !dataChunk) {
    throw new Error(`Nao foi possivel ler os dados de audio WAV: ${filePath}`)
  }

  return { format, dataChunk }
}

function assertSameFormat(baseFormat, currentFormat, filePath) {
  const keys = ["audioFormat", "channels", "sampleRate", "byteRate", "blockAlign", "bitsPerSample"]

  for (const key of keys) {
    if (baseFormat[key] !== currentFormat[key]) {
      throw new Error(`Formato de audio incompativel em ${path.basename(filePath)} (${key})`)
    }
  }
}

function buildWavBuffer(format, chunks) {
  const dataSize = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const output = Buffer.alloc(44 + dataSize)

  output.write("RIFF", 0, 4, "ascii")
  output.writeUInt32LE(36 + dataSize, 4)
  output.write("WAVE", 8, 4, "ascii")
  output.write("fmt ", 12, 4, "ascii")
  output.writeUInt32LE(16, 16)
  output.writeUInt16LE(format.audioFormat, 20)
  output.writeUInt16LE(format.channels, 22)
  output.writeUInt32LE(format.sampleRate, 24)
  output.writeUInt32LE(format.byteRate, 28)
  output.writeUInt16LE(format.blockAlign, 32)
  output.writeUInt16LE(format.bitsPerSample, 34)
  output.write("data", 36, 4, "ascii")
  output.writeUInt32LE(dataSize, 40)

  let writeOffset = 44
  for (const chunk of chunks) {
    chunk.copy(output, writeOffset)
    writeOffset += chunk.length
  }

  return output
}

export function createMergedAlbum(chapterPaths, outputFilePath) {
  if (!Array.isArray(chapterPaths) || chapterPaths.length === 0) {
    throw new Error("Nenhuma faixa de audio foi informada para montar o album")
  }

  const parsedFiles = chapterPaths.map((filePath) => ({
    filePath,
    ...parseWavFile(filePath)
  }))

  const baseFormat = parsedFiles[0].format
  for (const parsed of parsedFiles.slice(1)) {
    assertSameFormat(baseFormat, parsed.format, parsed.filePath)
  }

  const albumBuffer = buildWavBuffer(
    baseFormat,
    parsedFiles.map((parsed) => parsed.dataChunk)
  )

  fs.mkdirSync(path.dirname(outputFilePath), { recursive: true })
  fs.writeFileSync(outputFilePath, albumBuffer)

  return outputFilePath
}
