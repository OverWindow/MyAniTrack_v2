import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  loginIdentityLimit,
  loginIpLimit,
  passwordEmailDailyIpLimit,
  passwordEmailShortIpLimit,
  passwordResetConfirmIpLimit,
  supabaseAuthIpLimit,
} from '../middleware/rate-limit.middleware';
import {
  checkUsername,
  confirmPasswordReset,
  confirmVerificationEmail,
  deleteCurrentUser,
  getCurrentUser,
  loginWithSupabase,
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
router.post(
  '/auth/verify-email/resend',
  passwordEmailShortIpLimit,
  passwordEmailDailyIpLimit,
  resendVerificationEmail
);
router.post('/auth/verify-email/confirm', confirmVerificationEmail);
router.post('/auth/login', loginIpLimit, loginIdentityLimit, loginUser);
router.post('/auth/supabase', supabaseAuthIpLimit, loginWithSupabase);
router.post('/auth/refresh', refreshUserSession);
router.post(
  '/auth/password-reset/request',
  passwordEmailShortIpLimit,
  passwordEmailDailyIpLimit,
  requestPasswordResetEmail
);
router.post('/auth/password-reset/confirm', passwordResetConfirmIpLimit, confirmPasswordReset);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', requireAuth, getCurrentUser);
router.delete('/auth/me', requireAuth, deleteCurrentUser);
router.post('/auth/logout-all', requireAuth, logoutEverywhere);

export default router;
