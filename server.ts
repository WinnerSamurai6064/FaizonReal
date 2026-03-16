import express from "express";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Pool } from "pg";
import { v4 as uuidv4 } from "uuid";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs";

// Initialize environment variables
const PORT = process.env.PORT || 3000;

// Initialize Google Gen AI Keys
const getApiKeys = () => {
  const keys: { id: string; value: string }[] = [];
  for (let i = 1; i <= 5; i++) {
    const key = process.env[`GEMINI_KEY_${i}`];
    if (key) keys.push({ id: `GEMINI_KEY_${i}`, value: key });
  }
  // Fallback to GEMINI_API_KEY if specific ones aren't set
  if (keys.length === 0 && process.env.GEMINI_API_KEY) {
    keys.push({ id: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY });
  }
  return keys;
};

let currentKeyIndex = 0;
const getNextKey = (keys: { id: string; value: string }[]) => {
  if (keys.length === 0) return null;
  const key = keys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;
  return key;
};

// Initialize S3 Client
let s3Client: S3Client | null = null;
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_REGION) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

// Initialize Neon DB Pool
let dbPool: Pool | null = null;
if (process.env.DATABASE_URL) {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  
  // Create table if not exists
  dbPool.query(`
    CREATE TABLE IF NOT EXISTS generations (
      id UUID PRIMARY KEY,
      prompt TEXT NOT NULL,
      engine VARCHAR(50) NOT NULL,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS analytics_logs (
      id UUID PRIMARY KEY,
      engine VARCHAR(50) NOT NULL,
      api_key_used VARCHAR(100),
      status VARCHAR(20) NOT NULL,
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(err => console.error("Failed to create tables:", err));
}

// Analytics Logger
async function logAnalytics(engine: string, apiKeyUsed: string, status: string, errorMessage: string | null = null) {
  if (!dbPool) return;
  try {
    await dbPool.query(
      "INSERT INTO analytics_logs (id, engine, api_key_used, status, error_message) VALUES ($1, $2, $3, $4, $5)",
      [uuidv4(), engine, apiKeyUsed, status, errorMessage]
    );
  } catch (err) {
    console.error("Failed to log analytics:", err);
  }
}

// Multer setup for file uploads (in-memory for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 3 }, // 10MB limit per file, max 3 files
});

async function startServer() {
  const app = express();
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    const keys = getApiKeys();
    res.json({ status: "ok", aiKeysCount: keys.length, s3: !!s3Client, db: !!dbPool });
  });

  // Admin Analytics Endpoint
  app.get("/api/admin/analytics", async (req, res) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!dbPool) {
      return res.status(500).json({ error: "Database not configured" });
    }

    try {
      const totalQuery = await dbPool.query("SELECT COUNT(*) FROM analytics_logs");
      const successQuery = await dbPool.query("SELECT COUNT(*) FROM analytics_logs WHERE status = 'success'");
      const failureQuery = await dbPool.query("SELECT COUNT(*) FROM analytics_logs WHERE status = 'failure'");
      
      const engineStats = await dbPool.query("SELECT engine, COUNT(*) as count FROM analytics_logs GROUP BY engine");
      const keyStats = await dbPool.query("SELECT api_key_used, COUNT(*) as count, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successes FROM analytics_logs GROUP BY api_key_used");
      
      const recentLogs = await dbPool.query("SELECT * FROM analytics_logs ORDER BY created_at DESC LIMIT 50");

      res.json({
        totalAttempts: parseInt(totalQuery.rows[0].count),
        successes: parseInt(successQuery.rows[0].count),
        failures: parseInt(failureQuery.rows[0].count),
        successRate: parseInt(totalQuery.rows[0].count) > 0 ? (parseInt(successQuery.rows[0].count) / parseInt(totalQuery.rows[0].count)) * 100 : 0,
        byEngine: engineStats.rows,
        byKey: keyStats.rows,
        recentLogs: recentLogs.rows
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/generate", upload.array("images", 3), async (req, res) => {
    try {
      const keys = getApiKeys();
      if (keys.length === 0) {
        return res.status(500).json({ error: "Gemini API keys not configured." });
      }

      const { prompt, engine } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required." });
      }

      // 1. Construct the System Prompt based on the engine
      let systemInstruction = "";
      if (engine === "realistic") {
        systemInstruction = "You are Faizon Realistic, an expert AI image generator. Your task is to generate highly detailed, photorealistic images. Enforce photorealistic text-to-image generation and photorealistic multimodal edits. Pay close attention to specific camera lenses, precise lighting, realistic textures, and lifelike details. The output must look like a real photograph.";
      } else if (engine === "aesthetics") {
        systemInstruction = "You are Faizon Aesthetics, an expert AI image generator. Your task is to generate vibe-centric, highly stylized visual generation. Enforce specific aesthetics such as 'taken on iPhone 4s', '80s retro', 'radial blur', 'dualtone', 'surrealistic aesthetics', or 'cottagecore' based on the user's prompt. Prioritize mood, atmosphere, and artistic style over pure realism.";
      } else {
        return res.status(400).json({ error: "Invalid engine selected." });
      }

      // 2. Prepare the parts for Gemini API
      const parts: any[] = [];
      
      // Add uploaded images if any
      if (files && files.length > 0) {
        for (const file of files) {
          parts.push({
            inlineData: {
              data: file.buffer.toString("base64"),
              mimeType: file.mimetype,
            },
          });
        }
      }
      
      // Add the text prompt
      parts.push({ text: `System Instruction: ${systemInstruction}\n\nUser Prompt: ${prompt}` });

      // 3. Call Gemini API with Retry Logic
      console.log(`Starting generation with engine: ${engine}`);
      let generatedImageBase64 = "";
      let generatedImageMimeType = "image/png";
      let successfulKey = "";
      
      let attempts = 0;
      const maxAttempts = keys.length;
      let lastError: any = null;
      let success = false;

      while (attempts < maxAttempts && !success) {
        const keyObj = getNextKey(keys);
        if (!keyObj) break;

        try {
          console.log(`Attempt ${attempts + 1}: Using key ${keyObj.id}`);
          const aiInstance = new GoogleGenAI({ apiKey: keyObj.value });
          const response = await aiInstance.models.generateContent({
            model: "gemini-3.1-flash-image-preview",
            contents: { parts },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: "1K"
              }
            }
          });

          if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                generatedImageBase64 = part.inlineData.data;
                generatedImageMimeType = part.inlineData.mimeType || "image/png";
                break;
              }
            }
          }

          if (!generatedImageBase64) {
            throw new Error("No image generated by the model.");
          }

          success = true;
          successfulKey = keyObj.id;
          await logAnalytics(engine, keyObj.id, 'success');
        } catch (error: any) {
          console.error(`Key ${keyObj.id} failed:`, error.message);
          lastError = error;
          await logAnalytics(engine, keyObj.id, 'failure', error.message);
          attempts++;
        }
      }

      if (!success) {
        throw new Error(`All API keys failed. Last error: ${lastError?.message || 'Unknown error'}`);
      }

      const imageBuffer = Buffer.from(generatedImageBase64, "base64");
      const generationId = uuidv4();
      const filename = `${generationId}.png`;
      let imageUrl = `data:${generatedImageMimeType};base64,${generatedImageBase64}`;

      // 5. Upload to S3 (if configured)
      if (s3Client && process.env.AWS_S3_BUCKET_NAME) {
        try {
          await s3Client.send(new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: filename,
            Body: imageBuffer,
            ContentType: generatedImageMimeType,
            // ACL: "public-read" // Optional depending on bucket settings
          }));
          imageUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
          console.log("Image uploaded to S3:", imageUrl);
        } catch (s3Error) {
          console.error("Failed to upload to S3:", s3Error);
          // Fallback to base64 if S3 fails
        }
      }

      // 6. Save to Neon DB (if configured)
      if (dbPool) {
        try {
          await dbPool.query(
            "INSERT INTO generations (id, prompt, engine, image_url) VALUES ($1, $2, $3, $4)",
            [generationId, prompt, engine, imageUrl]
          );
          console.log("Generation saved to database.");
        } catch (dbError) {
          console.error("Failed to save to database:", dbError);
        }
      }

      res.json({
        id: generationId,
        imageUrl,
        prompt,
        engine
      });

    } catch (error: any) {
      console.error("Generation error:", error);
      res.status(500).json({ error: error.message || "An error occurred during generation." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
