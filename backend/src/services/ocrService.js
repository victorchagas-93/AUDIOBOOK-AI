import Tesseract from "tesseract.js"
import { PDFParse } from "pdf-parse"

/**
 * Verifica se um PDF contém principalmente texto ou imagens
 * Se a quantidade de texto extraído é pequena, é provável que seja escaneado
 */
export async function isScannedPDF(pdfBuffer) {
  try {
    const parser = new PDFParse({ data: pdfBuffer })
    const data = await parser.getText()
    const totalText = data.text.trim()
    
    // Se o texto extraído é muito pequeno, provavelmente é um PDF escaneado
    return totalText.length < 50
  } catch (error) {
    console.error("Erro ao verificar PDF:", error)
    return false
  }
}

/**
 * Extrai texto de um PDF escaneado usando OCR com Tesseract
 * Para simplificar, usa a base64 diretamente
 */
export async function extractTextFromScannedPDF(pdfBuffer) {
  try {
    console.log("Iniciando OCR com Tesseract...")
    
    // Converter buffer para base64
    const base64Image = pdfBuffer.toString("base64")
    const dataUrl = `data:application/pdf;base64,${base64Image}`

    // Usar Tesseract para OCR
    const { data: { text } } = await Tesseract.recognize(
      dataUrl,
      "por+eng", // Português e Inglês
      {
        logger: m => {
          if (m.status === "recognizing text") {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      }
    )

    return text
  } catch (error) {
    console.error("Erro ao extrair texto com OCR:", error)
    throw error
  }
}

/**
 * Processa PDF, detectando se é escaneado e extraindo texto
 */
export async function processScannedPDF(pdfBuffer) {
  try {
    console.log("Verificando tipo de PDF...")
    const scanned = await isScannedPDF(pdfBuffer)

    if (scanned) {
      console.log("PDF escaneado detectado. Executando OCR...")
      const text = await extractTextFromScannedPDF(pdfBuffer)
      return {
        isScanned: true,
        text: text,
        method: "OCR"
      }
    } else {
      console.log("PDF com texto detectado.")
      return {
        isScanned: false,
        text: null,
        method: "direct"
      }
    }
  } catch (error) {
    console.error("Erro ao processar PDF:", error)
    throw error
  }
}

