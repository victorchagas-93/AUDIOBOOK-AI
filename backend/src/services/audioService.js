import { generateAudio } from "./ttsService.js"

export const generateAndUploadAudio = async (text, fileName, voice = "pf_dora") => {
  try {
    return await generateAudio(text, fileName, { voice, langCode: "p" })
  } catch (error) {
    console.error("Erro no Servico de Audio:", error)
    throw error
  }
}
