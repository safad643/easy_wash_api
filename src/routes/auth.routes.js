const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

router.post('/google', authController.googleAuth);
router.post('/phone/send-otp', authController.sendOTP);
router.post('/phone/verify', authController.verifyOTP);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
