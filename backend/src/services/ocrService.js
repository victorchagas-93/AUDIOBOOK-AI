import Tesseract from "tesseract.js"
import { PDFParse } from "pdf-parse"

function normalizeExtractedText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
}

function getScreenshotBuffer(page) {
  if (Buffer.isBuffer(page?.data)) {
    return page.data
  }

  if (Buffer.isBuffer(page?.imageBuffer)) {
    return page.imageBuffer
  }

  if (typeof page?.data === "string") {
    return Buffer.from(page.data, "base64")
  }

  if (typeof page?.imageBuffer === "string") {
    return Buffer.from(page.imageBuffer, "base64")
  }

  return null
}

export async function isScannedPDF(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer })

  try {
    const data = await parser.getText()
    const totalText = normalizeExtractedText(data.text)
    return totalText.length < 50
  } catch (error) {
    console.error("Erro ao verificar PDF:", error)
    return false
  } finally {
    await parser.destroy().catch(() => {})
  }
}

export async function extractTextFromScannedPDF(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer })

  try {
    console.log("Iniciando OCR com Tesseract...")

    const screenshotResult = await parser.getScreenshot({
      scale: 1.5,
      imageBuffer: true,
      imageDataUrl: false
    })

    const pages = Array.isArray(screenshotResult?.pages) ? screenshotResult.pages : []

    if (pages.length === 0) {
      throw new Error("Nenhuma pagina renderizada para OCR")
    }

    const texts = []

    for (let index = 0; index < pages.length; index += 1) {
      const imageBuffer = getScreenshotBuffer(pages[index])

      if (!imageBuffer) {
        throw new Error(`Pagina ${index + 1} sem imagem renderizada para OCR`)
      }

      const { data: { text } } = await Tesseract.recognize(
        imageBuffer,
        "por+eng",
        {
          logger: (message) => {
            if (message.status === "recognizing text") {
              console.log(`OCR pagina ${index + 1}/${pages.length}: ${Math.round(message.progress * 100)}%`)
            }
          }
        }
      )

      const normalized = normalizeExtractedText(text)

      if (normalized) {
        texts.push(normalized)
      }
    }

    return texts.join("\n\n")
  } catch (error) {
    console.error("Erro ao extrair texto com OCR:", error)
    throw error
  } finally {
    await parser.destroy().catch(() => {})
  }
}

export async function processScannedPDF(pdfBuffer) {
  try {
    console.log("Verificando tipo de PDF...")
    const scanned = await isScannedPDF(pdfBuffer)

    if (scanned) {
      console.log("PDF escaneado detectado. Executando OCR...")
      const text = await extractTextFromScannedPDF(pdfBuffer)
      return {
        isScanned: true,
        text,
        method: "OCR"
      }
    }

    console.log("PDF com texto detectado.")
    return {
      isScanned: false,
      text: null,
      method: "direct"
    }
  } catch (error) {
    console.error("Erro ao processar PDF:", error)
    throw error
  }
}
