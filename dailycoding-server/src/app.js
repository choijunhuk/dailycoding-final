import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { configureMiddleware } from './middleware/setup.js';
import { registerRoutes } from './routes/registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createApp() {
  const app = express();
  configureMiddleware(app);
  app.use('/uploads', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(join(__dirname, '..', 'uploads')));
  registerRoutes(app);
  return app;
}
