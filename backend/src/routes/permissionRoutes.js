import express from "express"
import {
  grantPermissions,
  listAudiobookPermissions,
  listUsers,
  revokePermission
} from "../controllers/permissionController.js"
import { verifyToken } from "../middleware/authMiddleware.js"

const router = express.Router()

router.get("/users", verifyToken, listUsers)
router.get("/:audiobookId", verifyToken, listAudiobookPermissions)
router.post("/grant", verifyToken, grantPermissions)
router.delete("/:audiobookId/users/:userId", verifyToken, revokePermission)

export default router
