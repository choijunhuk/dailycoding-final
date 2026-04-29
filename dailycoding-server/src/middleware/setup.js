import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import xss from 'xss';
import logger from '../config/logger.js';

export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((value) => value.trim());

function buildConnectSrc() {
  const sources = new Set(["'self'"]);
  for (const origin of ALLOWED_ORIGINS) {
    if (!origin) continue;
    sources.add(origin);
    if (origin.startsWith('http://')) sources.add(origin.replace('http://', 'ws://'));
    if (origin.startsWith('https://')) sources.add(origin.replace('https://', 'wss://'));
  }
  return Array.from(sources);
}

const xssOptions = {
  whiteList: {},
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'iframe', 'object', 'embed'],
};

const myXss = new xss.FilterXSS(xssOptions);
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SKIP_SANITIZE_KEYS = new Set([
  'code', 'sourceCode', 'answer', 'blankAnswers', 'testcases',
  'specialConfig', 'codeTemplate', 'buggyCode', 'input_data', 'output_data',
  'input_desc', 'output_desc', 'description', 'solution', 'hint',
]);

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    obj.forEach((_, index) => {
      if (typeof obj[index] === 'string') obj[index] = myXss.process(obj[index]);
      else if (typeof obj[index] === 'object') sanitize(obj[index]);
    });
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_KEYS.has(key)) {
      delete obj[key];
      continue;
    }
    if (SKIP_SANITIZE_KEYS.has(key)) continue;
    if (typeof obj[key] === 'string') obj[key] = myXss.process(obj[key]);
    else if (typeof obj[key] === 'object') sanitize(obj[key]);
  }
  return obj;
}

export function configureMiddleware(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      logger.warn(`CORS 차단: ${origin} (허용목록: ${ALLOWED_ORIGINS.join(', ')})`);
      cb(new Error('CORS 정책에 의해 차단된 출처입니다.'));
    },
    credentials: true,
  }));
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: buildConnectSrc(),
        imgSrc: ["'self'", 'data:', 'https:'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
  }));
  app.use(cookieParser());
  app.use('/api/subscription/webhook', express.raw({ type: 'application/json' }));
  app.use(express.json({ limit: '5mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') sanitize(req.body);
    next();
  });

  app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    req.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const meta = {
        requestId,
        userId: req.user?.id || null,
        endpoint: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        method: req.method,
      };
      if (res.statusCode >= 500) logger.error('HTTP request', meta);
      else if (res.statusCode >= 400) logger.warn('HTTP request', meta);
      else logger.info('HTTP request', meta);
    });

    next();
  });
}
