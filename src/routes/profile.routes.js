const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/', authenticate, profileController.getProfile);
router.patch('/', authenticate, profileController.updateProfile);
router.patch('/security', authenticate, profileController.changePassword);
router.post('/delete', authenticate, profileController.deleteAccount);

module.exports = router;


