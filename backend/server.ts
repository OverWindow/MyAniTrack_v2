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
  return [
    process.env.FRONT_DOMAIN1,
    process.env.FRONT_DOMAIN2,
    process.env.FRONT_DOMAIN3,
  ].filter((origin): origin is string => Boolean(origin?.trim()));
}

app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const requestOrigin = req.header('Origin');

  if (isProduction) {
    const allowedOrigins = getAllowedOrigins();

    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Vary', 'Origin');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  return next();
});

app.use(express.json());

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
