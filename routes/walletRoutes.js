const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getWallet, requestWithdrawal } = require('../controllers/walletController');

router.use(protect);
router.use(authorize('seller'));

router.get('/', getWallet);
router.post('/withdraw', requestWithdrawal);

module.exports = router;
