import crypto from 'crypto';
import multer from 'multer';
import { NextFunction, Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getUserProfile, updateMyProfile } from '../controllers/user-profile.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('profileImage must be an image file'));
      return;
    }

    callback(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function uploadProfileImage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  upload.single('profileImage')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    const requestId = req.header('x-request-id')?.trim() || crypto.randomUUID();
    res.setHeader('x-request-id', requestId);
    const fileTooLarge =
      error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
    const statusCode = fileTooLarge ? 413 : 400;
    const message = fileTooLarge
      ? '프로필 이미지는 5MB 이하여야 합니다.'
      : '지원하지 않는 프로필 이미지입니다.';

    console.warn(JSON.stringify({
      event: 'profile_update',
      stage: 'multipart_rejected',
      requestId,
      userId: req.authUser?.userId,
      statusCode,
      errorCode:
        error instanceof multer.MulterError ? error.code : 'INVALID_FILE',
    }));

    res.status(statusCode).json({ success: false, message });
  });
}

router.get('/users/:userId/profile', getUserProfile);
router.patch('/me/profile', requireAuth, uploadProfileImage, updateMyProfile);

export default router;
