const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderDetails, getSellerOrders } = require('../controllers/orderController');
const { protect, authorize } = require('../middleware/auth');

router.post('/', protect, createOrder);
router.get('/', protect, getOrders);
router.get('/seller', protect, getSellerOrders);
router.get('/:id', protect, getOrderDetails);

module.exports = router;
