import express from "express"
import { listProcessingLogs } from "../controllers/logController.js"
import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.get("/", verifyToken, listProcessingLogs)

export default router
