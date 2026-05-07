import multer from 'multer';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getUserProfile, updateMyProfile } from '../controllers/user-profile.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.get('/users/:userId/profile', getUserProfile);
router.patch('/me/profile', requireAuth, upload.single('profileImage'), updateMyProfile);

export default router;
