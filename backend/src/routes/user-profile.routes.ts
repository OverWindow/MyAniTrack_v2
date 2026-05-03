import multer from 'multer';
import { Request, Response, Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { updateUserProfile } from '../services/user-profile.service';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

function getErrorStatus(message: string) {
  if (
    message.includes('must be') ||
    message.includes('required') ||
    message === 'At least one profile field is required'
  ) {
    return 400;
  }

  if (message === 'Username already exists') {
    return 409;
  }

  if (message === 'User not found') {
    return 404;
  }

  return 500;
}

router.patch('/me/profile', requireAuth, upload.single('profileImage'), async (req: Request, res: Response) => {
  try {
    const authUser = req.authUser;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const user = await updateUserProfile({
      userId: authUser.userId,
      username: req.body.username,
      removeProfileImage: req.body.removeProfileImage,
      profileImage: req.file,
    });

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = getErrorStatus(message);

    if (statusCode === 500) {
      console.error(error);
    }

    return res.status(statusCode).json({
      success: false,
      message,
    });
  }
});

export default router;
