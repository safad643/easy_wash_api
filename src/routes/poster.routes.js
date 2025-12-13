const express = require('express');
const posterController = require('../controllers/poster.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Public router - for landing page
const publicRouter = express.Router();
publicRouter.get('/', posterController.getActivePosters);

// Admin router - for admin panel
const adminRouter = express.Router();
adminRouter.use(authenticate, authorize('admin'));

adminRouter.get('/', posterController.getPosters);
adminRouter.post('/', posterController.createPoster);
adminRouter.get('/:id', posterController.getPosterById);
adminRouter.patch('/:id', posterController.updatePoster);
adminRouter.delete('/:id', posterController.deletePoster);

module.exports = { publicRouter, adminRouter };
