import express from 'express';
import path from 'path';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // === PROXY ALL API REQUESTS TO BACKEND ENGINE (http://localhost:5000) ===
  app.use('/api', async (req, res) => {
    try {
      const targetUrl = `${BACKEND_URL}${req.url}`;
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          host: new URL(BACKEND_URL).host,
        },
        validateStatus: () => true,
      });

      res.status(response.status).json(response.data);
    } catch (err: any) {
      console.error('[Frontend Proxy Error]', err.message);
      res.status(502).json({
        success: false,
        message: 'Backend Service Unavailable. Ensure Backend is running on http://localhost:5000',
      });
    }
  });

  // === VITE SPA SERVING ===
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Frontend Mini App] Running at http://localhost:${PORT}`);
    console.log(`[Frontend Proxy] Forwarding /api -> ${BACKEND_URL}`);
  });
}

startServer().catch((err) => {
  console.error('[Frontend Startup Failed]', err);
});
