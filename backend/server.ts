import express from 'express';
import dotenv from 'dotenv';
import adminRoutes from './routes/admin.routes';
import animeRoutes from './src/routes/anime.routes';
import authRoutes from './src/routes/auth.routes';
import userAnimeListRoutes from './src/routes/user-anime-list.routes';
import userProfileRoutes from './src/routes/user-profile.routes';

dotenv.config();

const app = express();

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
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
app.use('/api', userAnimeListRoutes);
app.use('/api', userProfileRoutes);

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
