import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { timingSafeEqual } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  dotenv.config();

  const { initDatabase } = await import('./server/db.js');
  const { apiRouter } = await import('./server/api.js');
  const isProduction = process.env.NODE_ENV === 'production';
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || (isProduction ? '127.0.0.1' : '0.0.0.0');
  const app = express();

  // Initialize SQLite persistent tables and seed demo data
  console.log('[IncidentIQ] Initializing SQLite Persistent Database...');
  initDatabase();
  console.log('[IncidentIQ] Database initialized successfully.');

  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  app.use('/api', (req, res, next) => {
    const expectedToken = process.env.INCIDENTIQ_API_TOKEN;
    if (!expectedToken) return next();

    const suppliedToken = req.get('x-incidentiq-api-token') || '';
    const expectedBytes = Buffer.from(expectedToken);
    const suppliedBytes = Buffer.from(suppliedToken);
    if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
      return res.status(401).json({ error: 'Invalid API gateway token.' });
    }
    next();
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      platform: 'IncidentIQ',
      runtime: {
        platform: process.platform,
        architecture: process.arch,
        node: process.version
      },
      timestamp: new Date().toISOString()
    });
  });

  if (!isProduction) {
    // Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[IncidentIQ] Vite development middleware mounted.');
  } else {
    // Serve production static assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, host, () => {
    console.log(`[IncidentIQ] Server listening on http://${host}:${port}`);
  });
}

startServer().catch(err => {
  console.error('[IncidentIQ] Fatal server startup error:', err);
  process.exit(1);
});
