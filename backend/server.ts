import express from 'express';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.routes';
import animeRoutes from './src/routes/anime.routes';
import authRoutes from './src/routes/auth.routes';
import friendRoutes from './src/routes/friend.routes';
import platformStatsRoutes from './src/routes/platform-stats.routes';
import recommendationRoutes from './src/routes/recommendation.routes';
import userAgreementRoutes from './src/routes/user-agreement.routes';
import userAnimeListRoutes from './src/routes/user-anime-list.routes';
import userProfileRoutes from './src/routes/user-profile.routes';

dotenv.config();

const app = express();

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

app.use(adminRoutes);
app.use('/api', animeRoutes);
app.use('/api', authRoutes);
app.use('/api', friendRoutes);
app.use('/api', platformStatsRoutes);
app.use('/api', recommendationRoutes);
app.use('/api', userAgreementRoutes);
app.use('/api', userAnimeListRoutes);
app.use('/api', userProfileRoutes);

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
