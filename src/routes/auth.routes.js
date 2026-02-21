const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/google', authController.googleAuth);
router.post('/email/send-otp', authController.sendEmailOTP);
router.post('/email/verify', authController.verifyEmailOTP);
router.post('/login', authController.login);
router.post('/register/send-otp', authController.sendRegistrationOTP);
router.post('/register', authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);
router.post('/password/reset/send-otp', authController.sendPasswordResetOTP);
router.post('/password/reset', authController.resetPassword);

module.exports = router;
