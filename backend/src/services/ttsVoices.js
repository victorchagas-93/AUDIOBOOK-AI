export const BRAZILIAN_PORTUGUESE_VOICES = [
  {
    id: "pf_dora",
    label: "Dora",
    gender: "Feminina",
    langCode: "p"
  },
  {
    id: "pm_alex",
    label: "Alex",
    gender: "Masculina",
    langCode: "p"
  },
  {
    id: "pm_santa",
    label: "Santa",
    gender: "Masculina",
    langCode: "p"
  }
]

export const DEFAULT_TTS_VOICE = "pf_dora"
export const DEFAULT_TTS_LANG_CODE = "p"

export function listVoiceOptions() {
  return BRAZILIAN_PORTUGUESE_VOICES.map((voice) => ({ ...voice }))
}

export function findVoiceOption(voiceId) {
  return BRAZILIAN_PORTUGUESE_VOICES.find((voice) => voice.id === voiceId) || null
}

export function resolveVoiceSelection(voiceId) {
  const selectedVoice = findVoiceOption(voiceId) || findVoiceOption(DEFAULT_TTS_VOICE)

  return {
    voice: selectedVoice.id,
    langCode: selectedVoice.langCode
  }
}
