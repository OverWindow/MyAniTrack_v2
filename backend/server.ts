import express from 'express';
import { validateSupabaseStorageEnv } from './src/config/env';
import adminRoutes from './routes/admin.routes';
import animeRoutes from './src/routes/anime.routes';
import authRoutes from './src/routes/auth.routes';
import friendRoutes from './src/routes/friend.routes';
import contentModerationRoutes from './src/routes/content-moderation.routes';
import { runMigrations } from './src/database/migrate';
import guestSampleRoutes from './src/routes/guest-sample.routes';
import platformStatsRoutes from './src/routes/platform-stats.routes';
import recommendationRoutes from './src/routes/recommendation.routes';
import shareRoutes from './src/routes/share.routes';
import userAgreementRoutes from './src/routes/user-agreement.routes';
import userAnimeListRoutes from './src/routes/user-anime-list.routes';
import userProfileRoutes from './src/routes/user-profile.routes';
import userVoiceActorStatsRoutes from './src/routes/user-voice-actor-stats.routes';
import { getSharePreviewHtml } from './src/controllers/share-preview.controller';

validateSupabaseStorageEnv();

const app = express();

if (process.env.NODE_ENV === 'production') {
  const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
  const proxyHops = Number.isInteger(configuredProxyHops) && configuredProxyHops > 0
    ? configuredProxyHops
    : 1;
  app.set('trust proxy', proxyHops);
}

function getAllowedOrigins() {
  const developmentOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:5173'];

  return [
    ...developmentOrigins,
    process.env.FRONT_DOMAIN1,
    process.env.FRONT_DOMAIN2,
    process.env.FRONT_DOMAIN3,
  ].filter((origin): origin is string => Boolean(origin?.trim()));
}

function getRequestOrigin(req: express.Request) {
  const origin = req.header('Origin');

  if (origin) {
    return origin;
  }

  const referer = req.header('Referer');

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

app.use((req, res, next) => {
  const requestOrigin = req.header('Origin');
  const allowedOrigins = getAllowedOrigins();

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
      return res.sendStatus(403);
    }

    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

app.use((req, res, next) => {
  const unsafeMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!unsafeMethods.includes(req.method)) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);

  if (!requestOrigin) {
    return next();
  }

  if (!getAllowedOrigins().includes(requestOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed',
    });
  }

  return next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/share-preview/:token', getSharePreviewHtml);

app.use(adminRoutes);
app.use('/api', animeRoutes);
app.use('/api', authRoutes);
app.use('/api', friendRoutes);
app.use('/api', contentModerationRoutes);
app.use('/api', guestSampleRoutes);
app.use('/api', platformStatsRoutes);
app.use('/api', recommendationRoutes);
app.use('/api', shareRoutes);
app.use('/api', userAgreementRoutes);
app.use('/api', userAnimeListRoutes);
app.use('/api', userProfileRoutes);
app.use('/api', userVoiceActorStatsRoutes);

const PORT = Number(process.env.PORT || 4000);

async function startServer() {
  await runMigrations();
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

void startServer().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
