import express from "express"
import { register, login, me, refreshToken } from "../controllers/authController.js"
import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.post("/register", register)
router.post("/login", login)
router.post("/refresh", refreshToken)
router.get("/me", verifyToken, me)

export default router
