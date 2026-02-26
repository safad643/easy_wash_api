const express = require('express');
const router = express.Router();
const loginLogController = require('../controllers/loginLog.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// All login log endpoints require admin auth
router.use(authenticate, authorize('admin'));

router.get('/', loginLogController.getLoginLogs);
router.get('/grouped', loginLogController.getGroupedLoginLogs);

module.exports = router;

