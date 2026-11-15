import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { runMigrations } from './storage/migrations';
import { telemetryRouter } from './routes/telemetry';
import { layoutsRouter } from './routes/layouts';

// ─────────────────────────────────────────────────────────────────────────────
// ORBITRA Backend Server
// Port 3001 — Frontend Vite proxies /api → this server
// ─────────────────────────────────────────────────────────────────────────────

// Run DB migrations at startup
runMigrations();

const app = express();
const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'orbitra-server',
    version: '1.0.0',
    timestamp: Date.now(),
  });
});

// Routes
app.use('/api/telemetry', telemetryRouter);
app.use('/api/layouts', layoutsRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🛰  ORBITRA Backend running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Telemetry API: http://localhost:${PORT}/api/telemetry\n`);
});

export default app;
