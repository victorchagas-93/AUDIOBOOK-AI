import express from "express"
import {
  createChapter,
  listChapters,
  generateAudio,
  streamChapterAudio,
  downloadEncryptedChapterAudio
} from "../controllers/chapterController.js"

import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/", verifyToken, createChapter)
router.post("/:id/generate-audio", verifyToken, generateAudio)
router.get("/:id/audio/stream", verifyToken, streamChapterAudio)
router.get("/:id/audio/download-encrypted", verifyToken, downloadEncryptedChapterAudio)
router.get("/:audiobook_id", verifyToken, listChapters)

export default router
