import express from 'express';
import { configureMiddleware } from './middleware/setup.js';
import { registerRoutes } from './routes/registry.js';

export function createApp() {
  const app = express();
  configureMiddleware(app);
  registerRoutes(app);
  return app;
}
