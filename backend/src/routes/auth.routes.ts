import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  checkUsername,
  confirmPasswordReset,
  confirmVerificationEmail,
  getCurrentUser,
  loginUser,
  logoutEverywhere,
  logoutUser,
  refreshUserSession,
  requestPasswordResetEmail,
  resendVerificationEmail,
  signup,
} from '../controllers/auth.controller';

const router = Router();

router.get('/auth/check-username', checkUsername);
router.post('/auth/signup', signup);
router.post('/auth/verify-email/resend', resendVerificationEmail);
router.post('/auth/verify-email/confirm', confirmVerificationEmail);
router.post('/auth/login', loginUser);
router.post('/auth/refresh', refreshUserSession);
router.post('/auth/password-reset/request', requestPasswordResetEmail);
router.post('/auth/password-reset/confirm', confirmPasswordReset);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getCurrentUser);
router.post('/auth/logout-all', requireAuth, logoutEverywhere);

export default router;
