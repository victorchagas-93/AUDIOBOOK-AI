import React, { useEffect, useState } from "react"

function InlineAudioPreview({ chapterId, chapterTitle, onRequestAudio }) {
  const [audioUrl, setAudioUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (!requested) {
      return undefined
    }

    let active = true
    let objectUrl = ""

    async function loadAudio() {
      setLoading(true)
      setError("")

      try {
        const blob = await onRequestAudio(chapterId)
        objectUrl = URL.createObjectURL(blob)

        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }

        setAudioUrl(objectUrl)
      } catch {
        if (active) {
          setError("Preview indisponivel")
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadAudio()

    return () => {
      active = false
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [chapterId, onRequestAudio, requested])

  function handleLoadPreview() {
    setRequested(true)
  }

  if (!requested) {
    return (
      <button type="button" className="ghost-button" onClick={handleLoadPreview}>
        Carregar preview
      </button>
    )
  }

  if (loading) {
    return <span className="mini-audio-status">Carregando preview...</span>
  }

  if (error || !audioUrl) {
    return <span className="mini-audio-status">{error || "Preview indisponivel"}</span>
  }

  return (
    <audio
      className="mini-audio-player"
      controls
      preload="none"
      src={audioUrl}
      aria-label={`Preview do capítulo ${chapterTitle}`}
    />
  )
}

export default InlineAudioPreview
