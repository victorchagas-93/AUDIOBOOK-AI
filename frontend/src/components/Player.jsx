import React, { useEffect, useMemo, useRef, useState } from "react"

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

function Player({ audiobook, chapters, onRequestAudio, onDownloadEncryptedAudio }) {
  const audioRef = useRef(null)
  const [currentChapterId, setCurrentChapterId] = useState(null)
  const [audioUrl, setAudioUrl] = useState("")
  const [loadingChapterId, setLoadingChapterId] = useState(null)
  const [pendingPlay, setPendingPlay] = useState(false)
  const [volume, setVolume] = useState(1)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [bookmarks, setBookmarks] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [pendingSeek, setPendingSeek] = useState(null)
  const [downloadingChapterId, setDownloadingChapterId] = useState(null)

  const playableChapters = useMemo(
    () => chapters.filter((chapter) => chapter.audio_path || chapter.audio_url),
    [chapters]
  )

  const currentChapter = playableChapters.find((chapter) => chapter.id === currentChapterId) || null

  useEffect(() => {
    if (!audiobook || playableChapters.length === 0) {
      setCurrentChapterId(null)
      setAudioUrl("")
      return
    }

    const storedChapterId = Number(localStorage.getItem(`player:last:${audiobook.id}`))
    const existing = playableChapters.find((chapter) => chapter.id === storedChapterId)

    setCurrentChapterId(existing?.id || playableChapters[0].id)
    setAudioUrl("")

    const savedBookmarks = localStorage.getItem(`player:bookmarks:${audiobook.id}`)
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks))
      } catch {
        setBookmarks([])
      }
    } else {
      setBookmarks([])
    }
  }, [audiobook, playableChapters])

  useEffect(() => {
    if (!audiobook?.id) {
      return
    }

    const savedVolume = Number(localStorage.getItem(`player:volume:${audiobook.id}`))
    const savedRate = Number(localStorage.getItem(`player:rate:${audiobook.id}`))

    if (Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1) {
      setVolume(savedVolume)
    }

    if (Number.isFinite(savedRate) && savedRate > 0) {
      setPlaybackRate(savedRate)
    }
  }, [audiobook?.id])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }

    if (audiobook?.id) {
      localStorage.setItem(`player:volume:${audiobook.id}`, String(volume))
    }
  }, [volume, audiobook?.id])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate
    }

    if (audiobook?.id) {
      localStorage.setItem(`player:rate:${audiobook.id}`, String(playbackRate))
    }
  }, [playbackRate, audiobook?.id])

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [audioUrl])

  async function handleSelectChapter(chapterId, shouldAutoplay = true) {
    if (!chapterId) {
      return
    }

    setLoadingChapterId(chapterId)

    try {
      const blob = await onRequestAudio(chapterId)
      const nextUrl = URL.createObjectURL(blob)

      setAudioUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl)
        }

        return nextUrl
      })

      setCurrentChapterId(chapterId)
      setPendingPlay(shouldAutoplay)
      setCurrentTime(0)
      setDuration(0)

      if (audiobook?.id) {
        localStorage.setItem(`player:last:${audiobook.id}`, String(chapterId))
      }
    } finally {
      setLoadingChapterId(null)
    }
  }

  function handleLoadedMetadata() {
    if (!audioRef.current || !currentChapter) {
      return
    }

    const savedTime = Number(localStorage.getItem(`player:progress:${currentChapter.id}`))
    const nextTime = pendingSeek ?? savedTime

    if (nextTime > 0 && nextTime < audioRef.current.duration) {
      audioRef.current.currentTime = nextTime
      setCurrentTime(nextTime)
    }

    if (pendingPlay) {
      audioRef.current.play().catch(() => {})
      setPendingPlay(false)
    }

    setDuration(audioRef.current.duration || 0)
    setPendingSeek(null)
  }

  function handleTimeUpdate() {
    if (!audioRef.current || !currentChapter) {
      return
    }

    const newTime = audioRef.current.currentTime
    setCurrentTime(newTime)
    localStorage.setItem(`player:progress:${currentChapter.id}`, String(newTime))
  }

  function handlePlayPause() {
    if (!audioRef.current) {
      return
    }

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => {})
    }
  }

  function addBookmark() {
    if (!currentChapter || !audioRef.current) {
      return
    }

    const newBookmark = {
      id: Date.now(),
      chapterId: currentChapter.id,
      chapterTitle: currentChapter.title,
      time: audioRef.current.currentTime,
      formattedTime: formatDuration(audioRef.current.currentTime),
      createdAt: new Date().toISOString()
    }

    const newBookmarks = [...bookmarks, newBookmark]
    setBookmarks(newBookmarks)

    if (audiobook?.id) {
      localStorage.setItem(`player:bookmarks:${audiobook.id}`, JSON.stringify(newBookmarks))
    }
  }

  function removeBookmark(bookmarkId) {
    const newBookmarks = bookmarks.filter((bookmark) => bookmark.id !== bookmarkId)
    setBookmarks(newBookmarks)

    if (audiobook?.id) {
      localStorage.setItem(`player:bookmarks:${audiobook.id}`, JSON.stringify(newBookmarks))
    }
  }

  function jumpToBookmark(bookmark) {
    if (audioRef.current && bookmark.chapterId === currentChapter?.id) {
      audioRef.current.currentTime = bookmark.time
      return
    }

    setPendingSeek(bookmark.time)
    handleSelectChapter(bookmark.chapterId, true)
  }

  function skipBackward() {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 15)
    }
  }

  function skipForward() {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.min(duration, audioRef.current.currentTime + 30)
    }
  }

  async function handleDownloadCurrentChapter() {
    if (!currentChapter || !onDownloadEncryptedAudio) {
      return
    }

    setDownloadingChapterId(currentChapter.id)

    try {
      await onDownloadEncryptedAudio(currentChapter.id)
    } finally {
      setDownloadingChapterId(null)
    }
  }

  if (!audiobook) {
    return null
  }

  return (
    <section className="player-shell">
      <div className="player-card">
        <div className="player-header">
          <div>
            <p className="eyebrow">Player</p>
            <h3>{audiobook.title}</h3>
          </div>
          <span className="pill">{playableChapters.length} faixas prontas</span>
        </div>

        {playableChapters.length === 0 ? (
          <p className="muted">
            As faixas ainda nao foram geradas. Assim que o admin concluir a conversao, elas aparecem aqui.
          </p>
        ) : (
          <>
            <div className="track-list">
              {playableChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  className={`track-item ${chapter.id === currentChapterId ? "active" : ""}`}
                  onClick={() => handleSelectChapter(chapter.id)}
                  disabled={loadingChapterId === chapter.id}
                >
                  <span>{chapter.title}</span>
                  <span>
                    {loadingChapterId === chapter.id
                      ? "Carregando..."
                      : formatDuration(chapter.duration)}
                  </span>
                </button>
              ))}
            </div>

            <div className="player-footer">
              <div className="player-meta">
                <strong>{currentChapter?.title || "Selecione uma faixa"}</strong>
                <span className="muted">Retoma automaticamente de onde voce parou</span>
              </div>

              <audio
                ref={audioRef}
                src={audioUrl}
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                className="audio-element"
              />

              <div className="player-controls-basic">
                <button onClick={skipBackward} title="Retroceder 15 segundos" className="control-btn">
                  Voltar 15s
                </button>
                <button onClick={handlePlayPause} title={isPlaying ? "Pausar" : "Reproduzir"} className="control-btn play-btn">
                  {isPlaying ? "Pausar" : "Reproduzir"}
                </button>
                <button onClick={skipForward} title="Avancar 30 segundos" className="control-btn">
                  Avancar 30s
                </button>
                <button
                  onClick={() => setShowAdvancedControls(!showAdvancedControls)}
                  title="Mostrar ou ocultar controles avancados"
                  className="control-btn"
                >
                  Avancado
                </button>
                <button
                  onClick={handleDownloadCurrentChapter}
                  title="Baixar faixa criptografada"
                  className="control-btn"
                  disabled={!currentChapter || downloadingChapterId === currentChapter?.id}
                >
                  {downloadingChapterId === currentChapter?.id ? "Baixando..." : "Download seguro"}
                </button>
              </div>

              <div className="player-progress">
                <span className="time-display">{formatDuration(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  value={currentTime}
                  onChange={(event) => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = Number(event.target.value)
                    }
                  }}
                  className="progress-bar"
                />
                <span className="time-display">{formatDuration(duration)}</span>
              </div>

              {showAdvancedControls && (
                <div className="player-advanced-controls">
                  <div className="control-group">
                    <label>
                      Volume: <span className="value">{Math.round(volume * 100)}%</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(event) => setVolume(Number(event.target.value))}
                      className="slider"
                    />
                  </div>

                  <div className="control-group">
                    <label>
                      Velocidade: <span className="value">{playbackRate.toFixed(1)}x</span>
                    </label>
                    <div className="speed-buttons">
                      {[0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => setPlaybackRate(speed)}
                          className={`speed-btn ${playbackRate === speed ? "active" : ""}`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="control-group">
                    <label>Marcadores</label>
                    <button onClick={addBookmark} className="bookmark-btn">
                      Adicionar marcador
                    </button>
                    {bookmarks.length > 0 && (
                      <div className="bookmarks-list">
                        {bookmarks.map((bookmark) => (
                          <div key={bookmark.id} className="bookmark-item">
                            <button
                              onClick={() => jumpToBookmark(bookmark)}
                              className="bookmark-link"
                            >
                              {bookmark.chapterTitle} - {bookmark.formattedTime}
                            </button>
                            <button
                              onClick={() => removeBookmark(bookmark.id)}
                              className="bookmark-remove"
                              title="Remover"
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default Player
