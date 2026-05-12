import express from "express"

import {
  createAudiobook,
  listAudiobooks,
  deleteAudiobook,
  getAudiobookDetails,
  getProcessingStatus,
  generateAudiobookAlbum,
  listTtsVoices,
  streamAudiobookAlbum,
  updateAudiobookTtsSettings
} from "../controllers/audiobookController.js"

import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/", verifyToken, createAudiobook)
router.get("/", verifyToken, listAudiobooks)
router.get("/tts/options", verifyToken, listTtsVoices)
router.post("/:id/generate-album", verifyToken, generateAudiobookAlbum)
router.get("/:id/album/stream", verifyToken, streamAudiobookAlbum)
router.get("/:id/status", verifyToken, getProcessingStatus)
router.patch("/:id/tts-settings", verifyToken, updateAudiobookTtsSettings)
router.get("/:id", verifyToken, getAudiobookDetails)
router.delete("/:id", verifyToken, deleteAudiobook)

export default router
