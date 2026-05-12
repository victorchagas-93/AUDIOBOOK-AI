import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import authRoutes from "./src/routes/authRoutes.js"
import audiobookRoutes from "./src/routes/audiobookRoutes.js"
import chapterRoutes from "./src/routes/chapterRoutes.js"
import uploadRoutes from "./src/routes/uploadRoutes.js"
import permissionRoutes from "./src/routes/permissionRoutes.js"
import logRoutes from "./src/routes/logRoutes.js"
import { initDatabase } from "./src/config/database.js"

dotenv.config()
initDatabase()

const app = express()

const corsOptions = {
  origin: true, // allow reflect origin for dev (safer for development)
  methods: 'GET,POST,PUT,PATCH,DELETE',
  credentials: true,
  exposedHeaders: ['Content-Disposition']
};

app.use(cors(corsOptions))
app.use(express.json())

app.use("/auth", authRoutes)
app.use("/audiobooks", audiobookRoutes)
app.use("/chapters", chapterRoutes)
app.use("/upload", uploadRoutes)
app.use("/permissions", permissionRoutes)
app.use("/logs", logRoutes)

app.get("/", (req, res) => {
  res.send("API Audiobook funcionando com SQLite")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
