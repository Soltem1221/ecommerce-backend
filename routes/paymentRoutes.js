const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { initializePayment, verifyPayment, handleWebhook } = require('../controllers/paymentController');

router.post('/initialize', protect, initializePayment);
router.get('/verify/:tx_ref', verifyPayment);
router.post('/callback', handleWebhook); // Webhook endpoint

module.exports = router;
