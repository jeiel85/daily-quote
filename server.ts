import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // API routes go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Serve Firebase config dynamically from environment variables or local file
  app.get("/firebase-applet-config.json", async (req, res) => {
    let localConfig = {};
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      const fs = await import("fs/promises");
      const data = await fs.readFile(configPath, "utf-8");
      localConfig = JSON.parse(data);
    } catch (e) {
      console.warn("Could not read firebase-applet-config.json from disk");
    }

    res.json({
      apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || (localConfig as any).apiKey,
      authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || (localConfig as any).authDomain,
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || (localConfig as any).projectId,
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || (localConfig as any).storageBucket,
      messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || (localConfig as any).messagingSenderId,
      appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || (localConfig as any).appId,
      measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || process.env.FIREBASE_MEASUREMENT_ID || (localConfig as any).measurementId,
      firestoreDatabaseId: process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || (localConfig as any).firestoreDatabaseId,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve the built files
    // Note: outDir is 'docs' in vite.config.ts
    const distPath = path.join(process.cwd(), 'docs');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
