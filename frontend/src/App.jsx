import React, { useEffect, useMemo, useRef, useState } from "react"
import InlineAudioPreview from "./components/InlineAudioPreview"
import Player from "./components/Player"
import {
  createAudiobook,
  deleteAudiobook,
  downloadEncryptedChapter,
  fetchAudiobookAlbumBlob,
  fetchAudiobookDetails,
  fetchChapterAudioBlob,
  fetchMe,
  fetchProcessingStatus,
  generateAudiobookAlbum,
  generateChapterAudio,
  grantPermissions,
  listAudiobookPermissions,
  listAudiobooks,
  listTtsVoices,
  listLogs,
  listUsers,
  loginUser,
  registerUser,
  refreshSession,
  revokePermission,
  setAuthToken,
  setRefreshTokenHandler,
  updateAudiobookTtsSettings,
  uploadAudiobooks
} from "../services/api"

const SESSION_KEY = "aiaudiobook:session"
const THEME_KEY = "aiaudiobook:theme"

function formatDuration(seconds) {
  const totalSeconds = Number(seconds) || 0
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const remainingSeconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`
}

function statusLabel(status) {
  const labels = {
    enviado: "Enviado",
    processando: "Processando",
    pronto: "Pronto",
    falhou: "Falhou",
    necessita_ocr: "Necessita OCR"
  }

  return labels[status] || status
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2.4M12 19.1v2.4M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M20.2 14.3A8.7 8.7 0 0 1 9.7 3.8a8.9 8.9 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 7.5h15M9.5 3.8h5l.7 1.7h3.3v2H5.5v-2h3.3l.7-1.7ZM8 9.5v7.8M12 9.5v7.8M16 9.5v7.8M6.8 7.5l.7 12.2a1.5 1.5 0 0 0 1.5 1.3h6a1.5 1.5 0 0 0 1.5-1.3l.7-12.2"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function App() {
  const [session, setSession] = useState(() => {
    const stored = localStorage.getItem(SESSION_KEY)
    return stored ? JSON.parse(stored) : null
  })
  const [authMode, setAuthMode] = useState("login")
  const [authLoading, setAuthLoading] = useState(false)
  const [appLoading, setAppLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    adminKey: ""
  })
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    ttsVoice: "pf_dora"
  })
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedAudiobookId, setSelectedAudiobookId] = useState(null)
  const [audiobooks, setAudiobooks] = useState([])
  const [selectedAudiobook, setSelectedAudiobook] = useState(null)
  const [users, setUsers] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [permissions, setPermissions] = useState([])
  const [logs, setLogs] = useState([])
  const [processingStatus, setProcessingStatus] = useState(null)
  const [generatingChapterId, setGeneratingChapterId] = useState(null)
  const [generatingAlbum, setGeneratingAlbum] = useState(false)
  const [playingAlbum, setPlayingAlbum] = useState(false)
  const [deletingAudiobook, setDeletingAudiobook] = useState(false)
  const [voiceCatalog, setVoiceCatalog] = useState({ defaultVoice: "pf_dora", voices: [] })
  const [voiceDraft, setVoiceDraft] = useState("pf_dora")
  const [savingVoiceSettings, setSavingVoiceSettings] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || "light")
  const sessionRef = useRef(session)
  const refreshPromiseRef = useRef(null)

  const isAdmin = session?.user?.role === "admin"

  useEffect(() => {
    sessionRef.current = session
    setAuthToken(session?.token || "")

    if (session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(SESSION_KEY)
    }
  }, [session])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    setRefreshTokenHandler(async () => {
      const currentSession = sessionRef.current

      if (!currentSession?.refreshToken) {
        setSession(null)
        return null
      }

      if (!refreshPromiseRef.current) {
        refreshPromiseRef.current = refreshSession(currentSession.refreshToken)
          .then((nextSession) => {
            const mergedSession = {
              ...currentSession,
              ...nextSession,
              refreshToken: nextSession.refreshToken || currentSession.refreshToken,
              user: nextSession.user || currentSession.user
            }

            setSession(mergedSession)
            return mergedSession
          })
          .catch(() => {
            setSession(null)
            return null
          })
          .finally(() => {
            refreshPromiseRef.current = null
          })
      }

      return refreshPromiseRef.current
    })
  }, [])

  useEffect(() => {
    if (!session?.token) {
      return
    }

    hydrateSession()
  }, [])

  useEffect(() => {
    if (!session?.token) {
      return
    }

    loadTtsVoices()
  }, [session?.token])

  useEffect(() => {
    if (!selectedAudiobook) {
      return
    }

    setVoiceDraft(selectedAudiobook.tts_voice || voiceCatalog.defaultVoice || "pf_dora")
  }, [selectedAudiobook, voiceCatalog.defaultVoice])

  useEffect(() => {
    if (createForm.ttsVoice) {
      return
    }

    setCreateForm((current) => ({
      ...current,
      ttsVoice: voiceCatalog.defaultVoice || "pf_dora"
    }))
  }, [createForm.ttsVoice, voiceCatalog.defaultVoice])

  useEffect(() => {
    if (!session?.token) {
      return
    }

    refreshDashboard()
  }, [session?.token])

  useEffect(() => {
    if (!session?.token || !selectedAudiobookId) {
      setSelectedAudiobook(null)
      setPermissions([])
      setProcessingStatus(null)
      return
    }

    loadAudiobookDetails(selectedAudiobookId)
    loadProcessingStatus(selectedAudiobookId)
  }, [session?.token, selectedAudiobookId])

  useEffect(() => {
    if (!session?.token || !selectedAudiobookId) {
      return
    }

    const intervalId = window.setInterval(() => {
      loadProcessingStatus(selectedAudiobookId, true)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [session?.token, selectedAudiobookId])

  const availableUsers = useMemo(
    () => users.filter((user) => user.role !== "admin"),
    [users]
  )

  async function hydrateSession() {
    try {
      const user = await fetchMe()
      setSession((current) => current ? { ...current, user } : current)
    } catch (requestError) {
      handleUnauthorized(requestError)
    }
  }

  async function refreshDashboard() {
    try {
      setAppLoading(true)
      setError("")

      const audiobookList = await listAudiobooks()
      setAudiobooks(audiobookList)

      if (audiobookList.length > 0) {
        setSelectedAudiobookId((current) => current || audiobookList[0].id)
      } else {
        setSelectedAudiobookId(null)
      }

      if (isAdmin) {
        const [userList, logList] = await Promise.all([listUsers(), listLogs()])
        setUsers(userList)
        setLogs(logList)
      }
    } catch (requestError) {
      handleUnauthorized(requestError)
    } finally {
      setAppLoading(false)
    }
  }

  async function loadTtsVoices() {
    try {
      const ttsOptions = await listTtsVoices()
      setVoiceCatalog(ttsOptions)
      setCreateForm((current) => ({
        ...current,
        ttsVoice: current.ttsVoice || ttsOptions.defaultVoice || "pf_dora"
      }))
    } catch (requestError) {
      handleUnauthorized(requestError)
    }
  }

  async function loadAudiobookDetails(audiobookId) {
    try {
      const details = await fetchAudiobookDetails(audiobookId)
      setSelectedAudiobook(details)

      if (isAdmin) {
        const permissionResponse = await listAudiobookPermissions(audiobookId)
        setPermissions(permissionResponse.permissions)
      }
    } catch (requestError) {
      handleUnauthorized(requestError)
    }
  }

  async function loadProcessingStatus(audiobookId, silent = false) {
    try {
      const status = await fetchProcessingStatus(audiobookId)
      setProcessingStatus(status)
    } catch (requestError) {
      if (!silent) {
        handleUnauthorized(requestError)
      }
    }
  }

  function handleUnauthorized(requestError) {
    const nextError = requestError?.response?.data?.error || requestError.message || "Erro inesperado"
    setError(nextError)

    if (requestError?.response?.status === 401) {
      setSession(null)
      setSelectedAudiobookId(null)
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthLoading(true)
    setError("")
    setMessage("")

    try {
      if (authMode === "register") {
        await registerUser(authForm)
        setMessage("Cadastro concluído. Faça login para acessar sua biblioteca.")
        setAuthMode("login")
        setAuthForm((current) => ({ ...current, password: "", adminKey: "" }))
        return
      }

      const response = await loginUser({
        email: authForm.email,
        password: authForm.password
      })

      setSession(response)
      setMessage(`Bem-vindo, ${response.user.name}.`)
      setAuthForm({
        name: "",
        email: authForm.email,
        password: "",
        adminKey: ""
      })
    } catch (requestError) {
        console.error('Login/Register error:', requestError)
        setError(requestError?.response?.data?.error || requestError?.message || "Não foi possível autenticar")
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleCreateAudiobook(event) {
    event.preventDefault()
    setError("")
    setMessage("")

    try {
      const created = await createAudiobook(createForm)
      setCreateForm({
        title: "",
        description: "",
        ttsVoice: voiceCatalog.defaultVoice || "pf_dora"
      })
      setMessage("Audiobook criado com sucesso.")
      await refreshDashboard()
      setSelectedAudiobookId(created.id)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Não foi possível criar o audiobook")
    }
  }

  async function handleUpload(event) {
    event.preventDefault()

    if (!selectedAudiobookId || selectedFiles.length === 0) {
      setError("Selecione um audiobook e ao menos um PDF.")
      return
    }

    setError("")
    setMessage("")
    setUploadProgress(0)

    try {
      await uploadAudiobooks({
        files: selectedFiles,
        audiobookId: selectedAudiobookId,
        onProgress: setUploadProgress
      })

      setMessage("Upload concluído. Os capítulos já foram extraídos e o status foi atualizado.")
      setSelectedFiles([])
      await refreshDashboard()
      await loadAudiobookDetails(selectedAudiobookId)
      await loadProcessingStatus(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Falha no upload dos PDFs")
    }
  }

  async function handleGenerateAudio(chapterId) {
    setGeneratingChapterId(chapterId)
    setError("")

    try {
      await generateChapterAudio(chapterId)
      setMessage("Áudio gerado com sucesso para a faixa selecionada.")
      await refreshDashboard()
      await loadAudiobookDetails(selectedAudiobookId)
      await loadProcessingStatus(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Não foi possível gerar o áudio")
    } finally {
      setGeneratingChapterId(null)
    }
  }

  async function handleGenerateAlbum() {
    if (!selectedAudiobookId || generatingAlbum) {
      return
    }

    setGeneratingAlbum(true)
    setError("")
    setMessage("")

    try {
      await generateAudiobookAlbum(selectedAudiobookId)
      setMessage("Album completo gerado com sucesso.")
      await refreshDashboard()
      await loadAudiobookDetails(selectedAudiobookId)
      await loadProcessingStatus(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Nao foi possivel gerar o album completo")
    } finally {
      setGeneratingAlbum(false)
    }
  }

  async function handlePlayAlbum() {
    if (!selectedAudiobookId || playingAlbum || !selectedAudiobook?.album_track) {
      return
    }

    setPlayingAlbum(true)
    setError("")

    try {
      const blob = await fetchAudiobookAlbumBlob(selectedAudiobookId)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank", "noopener,noreferrer")
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Nao foi possivel abrir o album completo")
    } finally {
      setPlayingAlbum(false)
    }
  }

  async function handleDeleteAudiobook() {
    if (!selectedAudiobookId || deletingAudiobook) {
      return
    }

    const confirmed = window.confirm("Deseja excluir este audiobook e todas as faixas vinculadas?")

    if (!confirmed) {
      return
    }

    setDeletingAudiobook(true)
    setError("")
    setMessage("")

    try {
      await deleteAudiobook(selectedAudiobookId)

      const remainingAudiobooks = audiobooks.filter((item) => item.id !== selectedAudiobookId)
      const nextSelectedId = remainingAudiobooks[0]?.id ?? null

      setSelectedAudiobookId(nextSelectedId)
      setSelectedAudiobook(null)
      setPermissions([])
      setProcessingStatus(null)
      setMessage("Audiobook excluido com sucesso.")

      await refreshDashboard()
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Nao foi possivel excluir o audiobook")
    } finally {
      setDeletingAudiobook(false)
    }
  }

  async function handleSaveVoiceSettings() {
    if (!selectedAudiobookId || !voiceDraft || savingVoiceSettings) {
      return
    }

    setSavingVoiceSettings(true)
    setError("")
    setMessage("")

    try {
      await updateAudiobookTtsSettings(selectedAudiobookId, { ttsVoice: voiceDraft })
      setMessage("Voz base atualizada. Gere novamente as faixas para refletir a nova locucao.")
      await refreshDashboard()
      await loadAudiobookDetails(selectedAudiobookId)
      await loadProcessingStatus(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Nao foi possivel atualizar a voz base")
    } finally {
      setSavingVoiceSettings(false)
    }
  }

  function handleToggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark")
  }

  function resolveVoiceLabel(voiceId) {
    const voice = voiceCatalog.voices.find((item) => item.id === voiceId)
    return voice ? `${voice.label} (${voice.gender})` : voiceId || "Nao definido"
  }

  async function handleGrantPermissions() {
    if (!selectedAudiobookId || selectedUserIds.length === 0) {
      setError("Selecione pelo menos um usuário para liberar o audiobook.")
      return
    }

    setError("")

    try {
      await grantPermissions({
        audiobook_id: selectedAudiobookId,
        user_ids: selectedUserIds
      })

      setSelectedUserIds([])
      setMessage("Permissões atualizadas com sucesso.")
      await loadAudiobookDetails(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Não foi possível conceder acesso")
    }
  }

  async function handleRevokePermission(userId) {
    try {
      await revokePermission(selectedAudiobookId, userId)
      setMessage("Acesso revogado com sucesso.")
      await loadAudiobookDetails(selectedAudiobookId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Não foi possível revogar o acesso")
    }
  }

  async function handleRequestAudio(chapterId) {
    try {
      return await fetchChapterAudioBlob(chapterId)
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Não foi possível carregar o áudio")
      throw requestError
    }
  }

  async function handleDownloadEncryptedAudio(chapterId) {
    try {
      const { blob, filename } = await downloadEncryptedChapter(chapterId)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setMessage("Download criptografado gerado com sucesso.")
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Nao foi possivel baixar o audio criptografado")
      throw requestError
    }
  }

  function handleLogout() {
    setSession(null)
    setSelectedAudiobookId(null)
    setSelectedAudiobook(null)
    setAudiobooks([])
    setPermissions([])
    setUsers([])
    setLogs([])
    setMessage("")
    setError("")
    setAuthMode("login")
  }

  if (!session?.token) {
    return (
      <div className="app-shell auth-shell">
        <style>{styles}</style>
        <section className="hero-card">
          <div className="hero-copy">
            <p className="eyebrow">Plataforma de Audiobooks</p>
            <h1>Converta PDFs em uma biblioteca de áudio com acesso controlado.</h1>
            <p className="muted">
              Cadastro, login, dashboard admin, permissões por usuário e biblioteca responsiva em um único fluxo.
            </p>
          </div>

          <form className="panel" onSubmit={handleAuthSubmit}>
            <div className="tabs">
              <button
                type="button"
                className={authMode === "login" ? "tab active" : "tab"}
                onClick={() => setAuthMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={authMode === "register" ? "tab active" : "tab"}
                onClick={() => setAuthMode("register")}
              >
                Cadastro
              </button>
            </div>

            {authMode === "register" && (
              <label className="field">
                <span>Nome</span>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  required
                />
              </label>
            )}

            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                required
              />
            </label>

            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                minLength={8}
                required
              />
            </label>

            {authMode === "register" && (
              <label className="field">
                <span>Chave admin opcional</span>
                <input
                  value={authForm.adminKey}
                  onChange={(event) => setAuthForm({ ...authForm, adminKey: event.target.value })}
                />
              </label>
            )}

            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? "Processando..." : authMode === "login" ? "Entrar" : "Criar conta"}
            </button>

            {message && <p className="success-text">{message}</p>}
            {error && <p className="error-text">{error}</p>}
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <style>{styles}</style>

      <header className="topbar">
        <div>
          <p className="eyebrow">{isAdmin ? "Dashboard Admin" : "Minha Biblioteca"}</p>
          <h1>{isAdmin ? "Gestão de audiobooks" : "Seus títulos liberados"}</h1>
        </div>

        <div className="topbar-actions">
          <button
            className="ghost-button icon-button theme-toggle"
            onClick={handleToggleTheme}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="user-chip">
            <strong>{session.user.name}</strong>
            <span>{session.user.role}</span>
          </div>
          <button className="ghost-button" onClick={handleLogout}>Sair</button>
        </div>
      </header>

      {(message || error) && (
        <div className={error ? "banner error-banner" : "banner success-banner"}>
          {error || message}
        </div>
      )}

      <main className="dashboard-grid">
        <section className="rail">
          <div className="panel">
            <div className="section-heading">
              <h2>{isAdmin ? "Catálogo" : "Biblioteca"}</h2>
              {appLoading && <span className="pill">Atualizando</span>}
            </div>

            {audiobooks.length === 0 ? (
              <p className="muted">Nenhum audiobook disponível no momento.</p>
            ) : (
              <div className="card-list">
                {audiobooks.map((audiobook) => (
                  <button
                    key={audiobook.id}
                    className={`catalog-card ${selectedAudiobookId === audiobook.id ? "selected" : ""}`}
                    onClick={() => setSelectedAudiobookId(audiobook.id)}
                  >
                    <div className="catalog-head">
                      <strong>{audiobook.title}</strong>
                      <span className={`status-badge status-${audiobook.status}`}>{statusLabel(audiobook.status)}</span>
                    </div>
                    <div className="catalog-meta">
                      <span>{audiobook.chapter_count} faixas</span>
                      <span>{formatDuration(audiobook.total_duration)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {isAdmin && (
            <form className="panel" onSubmit={handleCreateAudiobook}>
              <div className="section-heading">
                <h2>Novo audiobook</h2>
              </div>

              <label className="field">
                <span>Título</span>
                <input
                  value={createForm.title}
                  onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
                  required
                />
              </label>

              <label className="field">
                <span>Descrição</span>
                <textarea
                  rows="4"
                  value={createForm.description}
                  onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
                />
              </label>

              <label className="field">
                <span>Voz base pt-BR</span>
                <select
                  value={createForm.ttsVoice}
                  onChange={(event) => setCreateForm({ ...createForm, ttsVoice: event.target.value })}
                >
                  {voiceCatalog.voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label} ({voice.gender})
                    </option>
                  ))}
                </select>
              </label>

              <button className="primary-button" type="submit">Criar</button>
            </form>
          )}
        </section>

        <section className="content">
          {selectedAudiobook ? (
            <>
              <div className="panel hero-panel">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Detalhes</p>
                    <h2>{selectedAudiobook.title}</h2>
                  </div>
                  <div className="detail-actions">
                    <span className={`status-badge status-${selectedAudiobook.status}`}>
                      {statusLabel(selectedAudiobook.status)}
                    </span>
                    {isAdmin && (
                      <button
                        className="ghost-button icon-button danger-button"
                        type="button"
                        onClick={handleDeleteAudiobook}
                        disabled={deletingAudiobook}
                        aria-label="Excluir audiobook"
                        title="Excluir audiobook"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </div>

                <p className="muted">{selectedAudiobook.description || "Sem descrição cadastrada."}</p>

                <div className="voice-panel">
                  <div>
                    <strong>Voz base do audiobook</strong>
                    <p className="muted">
                      O Kokoro pt-BR sera executado em Python usando a voz salva neste titulo.
                    </p>
                  </div>

                  {isAdmin ? (
                    <div className="voice-actions">
                      <select
                        value={voiceDraft}
                        onChange={(event) => setVoiceDraft(event.target.value)}
                      >
                        {voiceCatalog.voices.map((voice) => (
                          <option key={voice.id} value={voice.id}>
                            {voice.label} ({voice.gender})
                          </option>
                        ))}
                      </select>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={handleSaveVoiceSettings}
                        disabled={savingVoiceSettings}
                      >
                        {savingVoiceSettings ? "Salvando..." : "Salvar voz"}
                      </button>
                    </div>
                  ) : (
                    <span className="pill">{resolveVoiceLabel(selectedAudiobook.tts_voice)}</span>
                  )}
                </div>

                <div className="stats-grid">
                  <div className="stat-card">
                    <span>Faixas</span>
                    <strong>{selectedAudiobook.chapter_count}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Duração total</span>
                    <strong>{formatDuration(selectedAudiobook.total_duration)}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Arquivo original</span>
                    <strong>{selectedAudiobook.original_pdf ? "Salvo localmente" : "Pendente"}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Album completo</span>
                    <strong>{selectedAudiobook.album_track ? "Disponivel" : "Nao gerado"}</strong>
                  </div>
                  <div className="stat-card">
                    <span>Voz ativa</span>
                    <strong>{resolveVoiceLabel(selectedAudiobook.tts_voice)}</strong>
                  </div>
                </div>

                {processingStatus && (
                  <div className="processing-panel">
                    <div className="section-heading">
                      <div>
                        <strong>Progresso da conversao</strong>
                        <p className="muted">
                          {processingStatus.completedChapters} de {processingStatus.totalChapters} faixas com audio pronto
                        </p>
                      </div>
                      <span className="pill">{processingStatus.progress}%</span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-fill" style={{ width: `${processingStatus.progress}%` }} />
                    </div>
                    {processingStatus.logs?.length > 0 && (
                      <div className="mini-log-list">
                        {processingStatus.logs.slice(0, 3).map((log, index) => (
                          <span key={`${log.created_at}-${index}`} className={`mini-log level-${log.level}`}>
                            {log.message}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isAdmin && (
                <form className="panel" onSubmit={handleUpload}>
                  <div className="section-heading">
                    <h2>Upload de PDFs</h2>
                    <span className="pill">até 10 arquivos</span>
                  </div>

                  <label className="field">
                    <span>Arquivos PDF</span>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
                    />
                  </label>

                  {uploadProgress > 0 && (
                    <div className="progress-wrap">
                      <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}

                  <button className="primary-button" type="submit">Enviar e extrair</button>
                </form>
              )}

              <div className="panel">
                <div className="section-heading">
                  <h2>Album completo</h2>
                  {selectedAudiobook.album_track && (
                    <span className="pill">
                      {formatDuration(selectedAudiobook.album_track.duration)}
                    </span>
                  )}
                </div>

                <p className="muted">
                  Gere um unico arquivo com todas as faixas em sequencia para ouvir o audiobook completo.
                </p>

                <div className="inline-actions">
                  {isAdmin && (
                    <button
                      className="primary-button"
                      type="button"
                      onClick={handleGenerateAlbum}
                      disabled={generatingAlbum}
                    >
                      {generatingAlbum ? "Gerando album..." : selectedAudiobook.album_track ? "Regenerar album" : "Gerar album completo"}
                    </button>
                  )}

                  {selectedAudiobook.album_track && (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={handlePlayAlbum}
                      disabled={playingAlbum}
                    >
                      {playingAlbum ? "Abrindo..." : "Ouvir album"}
                    </button>
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="section-heading">
                  <h2>Faixas</h2>
                  <span className="pill">{selectedAudiobook.chapters.length} itens</span>
                </div>

                <div className="chapter-list">
                  {selectedAudiobook.chapters.map((chapter) => (
                    <article key={chapter.id} className="chapter-card">
                      <div>
                        <strong>{chapter.order_index}. {chapter.title}</strong>
                        <p className="muted clamp">
                          {chapter.content ? `${chapter.content.slice(0, 220)}...` : "Sem conteúdo extraído."}
                        </p>
                      </div>

                      <div className="chapter-actions">
                        <div className="chapter-status">
                          <span className="pill">
                            {chapter.audio_path ? "Áudio pronto" : "Sem áudio"}
                          </span>
                          {chapter.audio_path && (
                            <InlineAudioPreview
                              chapterId={chapter.id}
                              chapterTitle={chapter.title}
                              onRequestAudio={fetchChapterAudioBlob}
                            />
                          )}
                        </div>
                        {isAdmin && (
                          <button
                            className="ghost-button"
                            onClick={() => handleGenerateAudio(chapter.id)}
                            disabled={generatingChapterId === chapter.id}
                          >
                            {generatingChapterId === chapter.id ? "Gerando..." : "Gerar áudio"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="split-grid">
                  <div className="panel">
                    <div className="section-heading">
                      <h2>Conceder acesso</h2>
                    </div>

                    <div className="user-pick-list">
                      {availableUsers.map((user) => (
                        <label key={user.id} className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={selectedUserIds.includes(user.id)}
                            onChange={(event) => {
                              setSelectedUserIds((current) => (
                                event.target.checked
                                  ? [...current, user.id]
                                  : current.filter((id) => id !== user.id)
                              ))
                            }}
                          />
                          <span>{user.name} ({user.email})</span>
                        </label>
                      ))}
                    </div>

                    <button className="primary-button" type="button" onClick={handleGrantPermissions}>
                      Liberar audiobook
                    </button>
                  </div>

                  <div className="panel">
                    <div className="section-heading">
                      <h2>Acessos ativos</h2>
                      <span className="pill">{permissions.length}</span>
                    </div>

                    {permissions.length === 0 ? (
                      <p className="muted">Nenhum usuário liberado para este título ainda.</p>
                    ) : (
                      <div className="permission-list">
                        {permissions.map((permission) => (
                          <div key={permission.id} className="permission-card">
                            <div className="permission-copy">
                              <strong>{permission.name}</strong>
                              <p className="muted">{permission.email}</p>
                            </div>
                            <button
                              className="ghost-button"
                              onClick={() => handleRevokePermission(permission.user_id)}
                            >
                              Revogar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isAdmin && (
                <Player
                  audiobook={selectedAudiobook}
                  chapters={selectedAudiobook.chapters}
                  onRequestAudio={handleRequestAudio}
                  onDownloadEncryptedAudio={handleDownloadEncryptedAudio}
                />
              )}
            </>
          ) : (
            <div className="panel">
              <p className="muted">Selecione um audiobook para ver os detalhes.</p>
            </div>
          )}
        </section>

        {isAdmin && (
          <aside className="rail">
            <div className="panel">
              <div className="section-heading">
                <h2>Logs de processamento</h2>
              </div>

              {logs.length === 0 ? (
                <p className="muted">Nenhuma falha registrada.</p>
              ) : (
                <div className="log-list">
                  {logs.map((log) => (
                    <article key={log.id} className="log-card">
                      <div className="log-card-head">
                        <strong>{log.audiobook_title || "Sem audiobook"}</strong>
                        <span className={`pill level-${log.level}`}>{log.level}</span>
                      </div>
                      <p>{log.message}</p>
                      <span className="muted">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </main>
    </div>
  )
}

const styles = `
  :root {
    color-scheme: light;
    --bg: #efe4d3;
    --surface: #fcf6ee;
    --panel: rgba(252, 246, 238, 0.9);
    --line: rgba(86, 58, 34, 0.12);
    --line-strong: rgba(86, 58, 34, 0.2);
    --ink: #2b1d12;
    --muted: #7b6757;
    --accent: #b96538;
    --accent-deep: #7c3f1f;
    --accent-soft: #e8c3a6;
    --success: #557d52;
    --danger: #9e4632;
    --shadow: 0 24px 70px rgba(105, 71, 39, 0.16);
    --shadow-soft: 0 14px 34px rgba(105, 71, 39, 0.08);
    font-family: "Roboto", sans-serif;
  }

  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #1a120e;
    --surface: #241915;
    --panel: rgba(36, 25, 21, 0.92);
    --line: rgba(239, 223, 205, 0.1);
    --line-strong: rgba(239, 223, 205, 0.18);
    --ink: #f5eadb;
    --muted: #c7b09a;
    --accent: #d7824f;
    --accent-deep: #f4c29b;
    --accent-soft: rgba(215, 130, 79, 0.16);
    --success: #8bc18a;
    --danger: #f29c82;
    --shadow: 0 26px 80px rgba(0, 0, 0, 0.42);
    --shadow-soft: 0 16px 34px rgba(0, 0, 0, 0.22);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background:
      radial-gradient(circle at top left, rgba(214, 151, 101, 0.26), transparent 26%),
      radial-gradient(circle at top right, rgba(117, 70, 36, 0.12), transparent 22%),
      radial-gradient(circle at bottom right, rgba(201, 143, 95, 0.18), transparent 24%),
      var(--bg);
    color: var(--ink);
    font-family: "Roboto", sans-serif;
  }

  button,
  input,
  textarea,
  select {
    font: inherit;
  }

  .app-shell {
    min-height: 100vh;
    padding: 24px;
  }

  .auth-shell {
    display: grid;
    place-items: center;
  }

  .hero-card,
  .dashboard-grid {
    width: min(1680px, 100%);
    margin: 0 auto;
  }

  .hero-card {
    display: grid;
    grid-template-columns: 1.2fr 0.8fr;
    gap: 24px;
    align-items: stretch;
  }

  .hero-copy,
  .panel {
    border: 1px solid var(--line);
    border-radius: 30px;
    background: var(--panel);
    box-shadow: var(--shadow);
    backdrop-filter: blur(16px);
  }

  .hero-copy {
    padding: 48px;
    display: grid;
    align-content: center;
    gap: 16px;
  }

  .hero-copy h1,
  .topbar h1 {
    margin: 0;
    font-size: clamp(2.1rem, 3vw, 4rem);
    line-height: 0.98;
    letter-spacing: -0.03em;
    font-weight: 900;
  }

  .panel {
    padding: 26px;
  }

  .tabs {
    display: inline-flex;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px;
    margin-bottom: 20px;
    background: rgba(255, 255, 255, 0.4);
  }

  .tab,
  .ghost-button,
  .primary-button,
  .catalog-card,
  .track-item {
    border: 0;
    cursor: pointer;
  }

  .tab {
    background: transparent;
    color: var(--muted);
    padding: 10px 16px;
    border-radius: 999px;
  }

  .tab.active,
  .primary-button {
    background: var(--accent);
    color: #fffaf2;
  }

  .field {
    display: grid;
    gap: 8px;
    margin-bottom: 16px;
  }

  .field input,
  .field textarea,
  .field select,
  .voice-actions select {
    width: 100%;
    padding: 14px 16px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.75);
    color: var(--ink);
  }

  :root[data-theme="dark"] .field input,
  :root[data-theme="dark"] .field textarea,
  :root[data-theme="dark"] .field select,
  :root[data-theme="dark"] .voice-actions select,
  :root[data-theme="dark"] .tabs,
  :root[data-theme="dark"] .ghost-button,
  :root[data-theme="dark"] .catalog-card,
  :root[data-theme="dark"] .chapter-card,
  :root[data-theme="dark"] .permission-card,
  :root[data-theme="dark"] .log-card,
  :root[data-theme="dark"] .track-item,
  :root[data-theme="dark"] .status-badge,
  :root[data-theme="dark"] .pill,
  :root[data-theme="dark"] .stat-card,
  :root[data-theme="dark"] .processing-panel,
  :root[data-theme="dark"] .mini-log,
  :root[data-theme="dark"] .player-card,
  :root[data-theme="dark"] .player-footer,
  :root[data-theme="dark"] .control-btn,
  :root[data-theme="dark"] .speed-btn,
  :root[data-theme="dark"] .bookmark-btn,
  :root[data-theme="dark"] .bookmark-link,
  :root[data-theme="dark"] .bookmark-remove {
    background: rgba(255, 255, 255, 0.04);
  }

  .primary-button,
  .ghost-button {
    padding: 13px 18px;
    border-radius: 16px;
    font-weight: 700;
    transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease, background 180ms ease;
  }

  .ghost-button {
    background: rgba(255, 255, 255, 0.46);
    color: var(--ink);
    border: 1px solid var(--line);
  }

  .primary-button:hover,
  .ghost-button:hover,
  .catalog-card:hover,
  .chapter-card:hover,
  .permission-card:hover,
  .log-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-soft);
  }

  .icon-button {
    width: 48px;
    min-width: 48px;
    height: 48px;
    padding: 0;
    display: inline-grid;
    place-items: center;
  }

  .icon-button svg {
    width: 20px;
    height: 20px;
  }

  .danger-button {
    color: var(--danger);
    border-color: rgba(166, 56, 45, 0.24);
  }

  .theme-toggle {
    border-color: var(--line-strong);
  }

  .detail-actions {
    flex-wrap: wrap;
  }

  .voice-panel,
  .voice-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
  }

  .voice-panel {
    margin: 18px 0 0;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.42);
  }

  .voice-actions {
    flex-wrap: wrap;
    min-width: min(100%, 360px);
  }

  .topbar {
    width: min(1680px, 100%);
    margin: 0 auto 28px;
    display: flex;
    justify-content: space-between;
    gap: 28px;
    align-items: center;
  }

  .topbar-actions,
  .user-chip,
  .catalog-head,
  .section-heading,
  .detail-actions,
  .player-header,
  .chapter-actions,
  .permission-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .section-heading,
  .chapter-actions,
  .detail-actions {
    flex-wrap: wrap;
  }

  .user-chip {
    flex-direction: column;
    align-items: flex-end;
    color: var(--muted);
    padding: 10px 14px;
    border-radius: 18px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.32);
  }

  .dashboard-grid {
    display: grid;
    grid-template-columns: minmax(300px, 360px) minmax(720px, 1.35fr) minmax(320px, 420px);
    gap: 24px;
    align-items: start;
  }

  .rail,
  .content {
    display: grid;
    gap: 20px;
  }

  .dashboard-grid > .rail:last-child {
    position: sticky;
    top: 24px;
  }

  .banner {
    width: min(1680px, 100%);
    margin: 0 auto 16px;
    padding: 14px 18px;
    border-radius: 18px;
    font-weight: 600;
  }

  .success-banner,
  .success-text {
    background: rgba(43, 122, 80, 0.12);
    color: var(--success);
  }

  .error-banner,
  .error-text {
    background: rgba(166, 56, 45, 0.12);
    color: var(--danger);
  }

  .eyebrow,
  .muted {
    color: var(--muted);
  }

  .eyebrow {
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .hero-panel {
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.3), transparent 42%),
      var(--panel);
  }

  .card-list,
  .chapter-list,
  .permission-list,
  .log-list,
  .track-list,
  .user-pick-list {
    display: grid;
    gap: 12px;
  }

  .catalog-card,
  .chapter-card,
  .permission-card,
  .log-card,
  .track-item {
    width: 100%;
    text-align: left;
    border-radius: 22px;
    padding: 18px;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid var(--line);
  }

  .catalog-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 10px;
    color: var(--muted);
  }

  .catalog-card.selected,
  .track-item.active {
    border-color: rgba(189, 93, 56, 0.65);
    box-shadow: inset 0 0 0 1px rgba(189, 93, 56, 0.25);
  }

  :root[data-theme="dark"] .catalog-card.selected,
  :root[data-theme="dark"] .track-item.active,
  :root[data-theme="dark"] .play-btn,
  :root[data-theme="dark"] .speed-btn.active,
  :root[data-theme="dark"] .primary-button,
  :root[data-theme="dark"] .tab.active {
    color: #fff6ef;
  }

  .status-badge,
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid var(--line);
  }

  .status-enviado { color: #7b5f2c; }
  .status-processando { color: #8b4a1f; }
  .status-pronto { color: var(--success); }
  .status-falhou { color: var(--danger); }
  .status-necessita_ocr { color: #5c4f94; }

  .stats-grid,
  .split-grid {
    display: grid;
    gap: 16px;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    margin-top: 18px;
  }

  .split-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-card {
    border-radius: 18px;
    padding: 16px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.45);
    display: grid;
    gap: 6px;
  }

  .progress-wrap {
    width: 100%;
    height: 12px;
    border-radius: 999px;
    background: rgba(30, 31, 27, 0.08);
    overflow: hidden;
    margin-bottom: 16px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), #d38759);
  }

  .processing-panel {
    margin-top: 18px;
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.42);
  }

  .processing-panel .muted {
    margin: 4px 0 0;
  }

  .mini-log-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .mini-log,
  .log-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mini-log {
    max-width: 100%;
    padding: 8px 10px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgba(255, 255, 255, 0.5);
    color: var(--muted);
    font-size: 0.85rem;
  }

  .log-card-head {
    justify-content: space-between;
  }

  .level-error { color: var(--danger); }
  .level-success { color: var(--success); }
  .level-info { color: #5d6180; }

  .checkbox-row {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid rgba(33, 37, 41, 0.08);
  }

  .clamp {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .chapter-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }

  .mini-audio-player {
    width: min(240px, 100%);
    height: 36px;
    accent-color: var(--accent);
    border-radius: 999px;
  }

  .mini-audio-status {
    color: var(--muted);
    font-size: 0.84rem;
  }

  .permission-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
  }

  .permission-copy {
    min-width: 0;
  }

  .permission-copy strong,
  .permission-copy .muted {
    overflow-wrap: anywhere;
  }

  .player-shell {
    padding-bottom: 120px;
  }

  .player-card {
    border: 1px solid var(--line);
    border-radius: 28px;
    padding: 24px;
    background: rgba(255, 255, 255, 0.65);
  }

  .player-footer {
    position: sticky;
    bottom: 12px;
    margin-top: 16px;
    padding: 16px;
    border-radius: 22px;
    background: rgba(255, 250, 242, 0.95);
    border: 1px solid var(--line);
    box-shadow: 0 12px 30px rgba(78, 54, 27, 0.14);
  }

  :root[data-theme="dark"] .player-footer {
    background: rgba(20, 23, 29, 0.94);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
  }

  .player-meta {
    display: grid;
    gap: 4px;
    margin-bottom: 12px;
  }

  .audio-element {
    display: none;
  }

  .player-controls-basic,
  .player-progress,
  .player-advanced-controls,
  .speed-buttons,
  .bookmark-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .player-controls-basic {
    flex-wrap: wrap;
    margin: 12px 0;
  }

  .control-btn,
  .speed-btn,
  .bookmark-btn,
  .bookmark-link,
  .bookmark-remove {
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.62);
    color: var(--ink);
    cursor: pointer;
    font-weight: 700;
  }

  .control-btn:disabled,
  .speed-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .bookmark-remove {
    min-width: 96px;
  }

  .play-btn,
  .speed-btn.active {
    background: var(--accent);
    color: #fffaf2;
  }

  .player-progress {
    width: 100%;
  }

  .player-progress input[type="range"],
  .slider {
    flex: 1;
    min-width: 120px;
    accent-color: var(--accent);
  }

  .time-display {
    width: 48px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }

  .player-advanced-controls {
    align-items: stretch;
    flex-direction: column;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
  }

  .control-group {
    display: grid;
    gap: 8px;
  }

  .inline-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 16px;
  }

  .control-group label {
    color: var(--muted);
    font-weight: 700;
  }

  .value {
    color: var(--ink);
  }

  .speed-buttons {
    flex-wrap: wrap;
  }

  .bookmarks-list {
    display: grid;
    gap: 8px;
  }

  .bookmark-item {
    justify-content: space-between;
  }

  .bookmark-link {
    flex: 1;
    text-align: left;
  }

  .bookmark-remove {
    color: var(--danger);
  }

  @media (max-width: 1080px) {
    .dashboard-grid > .rail:last-child {
      position: static;
    }

    .dashboard-grid,
    .hero-card,
    .split-grid,
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (min-width: 1400px) {
    .app-shell {
      padding: 32px;
    }

    .panel {
      padding: 30px;
    }
  }

  @media (max-width: 768px) {
    .app-shell {
      padding: 16px;
    }

    .hero-copy,
    .panel,
    .player-card {
      padding: 18px;
      border-radius: 18px;
    }

    .hero-copy h1,
    .topbar h1 {
      font-size: 2rem;
      line-height: 1.08;
    }

    .topbar,
    .topbar-actions,
    .section-heading,
    .catalog-head,
    .chapter-actions,
    .inline-actions,
    .player-header,
    .voice-panel,
    .voice-actions {
      flex-direction: column;
      align-items: flex-start;
    }

    .tabs,
    .topbar-actions,
    .primary-button,
    .ghost-button,
    .control-btn,
    .bookmark-btn,
    .bookmark-link {
      width: 100%;
    }

    .icon-button {
      width: 48px;
    }

    .tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .catalog-card,
    .chapter-card,
    .permission-card,
    .log-card,
    .track-item,
    .stat-card {
      border-radius: 14px;
      padding: 14px;
    }

    .player-shell {
      padding-bottom: 260px;
    }

    .player-footer {
      position: fixed;
      left: 12px;
      right: 12px;
      bottom: 12px;
      z-index: 20;
      max-height: min(62vh, 460px);
      overflow: auto;
      border-radius: 18px;
    }

    .player-controls-basic,
    .player-progress,
    .speed-buttons,
    .bookmark-item {
      align-items: stretch;
    }

    .player-controls-basic,
    .speed-buttons,
    .bookmark-item {
      flex-direction: column;
    }

    .player-progress {
      display: grid;
      grid-template-columns: 44px minmax(0, 1fr) 44px;
    }

    .player-progress input[type="range"],
    .slider {
      min-width: 0;
      width: 100%;
    }
  }

  @media (max-width: 480px) {
    .app-shell {
      padding: 12px;
    }

    .hero-copy h1,
    .topbar h1 {
      font-size: 1.7rem;
    }

    .panel,
    .player-card,
    .processing-panel {
      padding: 14px;
      border-radius: 14px;
    }

    .status-badge,
    .pill {
      width: 100%;
      justify-content: center;
      text-align: center;
    }

    .mini-log-list {
      display: grid;
    }

    .time-display {
      width: auto;
    }
  }
`

export default App
