import express from "express"
import { uploadMiddleware, uploadFile } from "../controllers/uploadController.js"
import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/", verifyToken, uploadMiddleware, uploadFile)

export default router
