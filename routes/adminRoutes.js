const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  approveProduct,
  getAllOrders,
  updateOrderStatus,
  getSystemReports,
  toggleFeatured
} = require('../controllers/adminController');

router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getDashboardStats);
router.get('/users', getAllUsers);
router.put('/users/:id/status', toggleUserStatus);
router.put('/products/:id/approve', approveProduct);
router.put('/products/:id/feature', toggleFeatured);
router.get('/orders', getAllOrders);
router.put('/orders/:id/status', updateOrderStatus);
router.get('/reports', getSystemReports);

module.exports = router;
