import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000"
})

// Debug: mostrar baseURL e logar requests/responses para diagnosticar "Network Error"
console.log("API baseURL:", api.defaults.baseURL)

api.interceptors.request.use((config) => {
  console.log("API request:", config.method, config.url, config.baseURL)
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API response error:", error.message, error?.response?.status, error?.config?.url)
    return Promise.reject(error)
  }
)

let refreshTokenHandler = null

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common.Authorization
  }
}

export function setRefreshTokenHandler(handler) {
  refreshTokenHandler = handler
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status !== 401 ||
      originalRequest?._retry ||
      originalRequest?.url === "/auth/refresh" ||
      !refreshTokenHandler
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true
    const session = await refreshTokenHandler()

    if (!session?.token) {
      return Promise.reject(error)
    }

    originalRequest.headers = originalRequest.headers || {}
    originalRequest.headers.Authorization = `Bearer ${session.token}`
    return api(originalRequest)
  }
)

export async function registerUser(payload) {
  const response = await api.post("/auth/register", payload)
  return response.data
}

export async function loginUser(payload) {
  const response = await api.post("/auth/login", payload)
  return response.data
}

export async function refreshSession(refreshToken) {
  const response = await api.post("/auth/refresh", { refreshToken })
  return response.data
}

export async function fetchMe() {
  const response = await api.get("/auth/me")
  return response.data
}

export async function listAudiobooks() {
  const response = await api.get("/audiobooks")
  return response.data
}

export async function fetchAudiobookDetails(audiobookId) {
  const response = await api.get(`/audiobooks/${audiobookId}`)
  return response.data
}

export async function listTtsVoices() {
  const response = await api.get("/audiobooks/tts/options")
  return response.data
}

export async function updateAudiobookTtsSettings(audiobookId, payload) {
  const response = await api.patch(`/audiobooks/${audiobookId}/tts-settings`, payload)
  return response.data
}

export async function fetchProcessingStatus(audiobookId) {
  const response = await api.get(`/audiobooks/${audiobookId}/status`)
  return response.data
}

export async function createAudiobook(payload) {
  const response = await api.post("/audiobooks", payload)
  return response.data
}

export async function deleteAudiobook(audiobookId) {
  const response = await api.delete(`/audiobooks/${audiobookId}`)
  return response.data
}

export async function generateAudiobookAlbum(audiobookId) {
  const response = await api.post(`/audiobooks/${audiobookId}/generate-album`)
  return response.data
}

export async function fetchAudiobookAlbumBlob(audiobookId) {
  const response = await api.get(`/audiobooks/${audiobookId}/album/stream`, {
    responseType: "blob"
  })

  return response.data
}

export async function uploadAudiobooks({ files, audiobookId, onProgress }) {
  const formData = new FormData()
  formData.append("audiobook_id", audiobookId)

  for (const file of files) {
    formData.append("files", file)
  }

  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    },
    onUploadProgress: (event) => {
      if (!event.total || !onProgress) {
        return
      }

      onProgress(Math.round((event.loaded * 100) / event.total))
    }
  })

  return response.data
}

export async function generateChapterAudio(chapterId) {
  const response = await api.post(`/chapters/${chapterId}/generate-audio`)
  return response.data
}

export async function listUsers() {
  const response = await api.get("/permissions/users")
  return response.data
}

export async function listAudiobookPermissions(audiobookId) {
  const response = await api.get(`/permissions/${audiobookId}`)
  return response.data
}

export async function grantPermissions(payload) {
  const response = await api.post("/permissions/grant", payload)
  return response.data
}

export async function revokePermission(audiobookId, userId) {
  const response = await api.delete(`/permissions/${audiobookId}/users/${userId}`)
  return response.data
}

export async function listLogs() {
  const response = await api.get("/logs")
  return response.data
}

export async function fetchChapterAudioBlob(chapterId) {
  const response = await api.get(`/chapters/${chapterId}/audio/stream`, {
    responseType: "blob"
  })

  return response.data
}

export async function downloadEncryptedChapter(chapterId) {
  const response = await api.get(`/chapters/${chapterId}/audio/download-encrypted`, {
    responseType: "blob"
  })

  const disposition = response.headers["content-disposition"] || ""
  const filenameMatch = disposition.match(/filename="?([^"]+)"?/i)

  return {
    blob: response.data,
    filename: filenameMatch?.[1] || `chapter-${chapterId}.encrypted.json`
  }
}

export default api
