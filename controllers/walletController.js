const db = require('../config/database');

exports.getWallet = async (req, res) => {
    try {
        const [wallet] = await db.query('SELECT * FROM seller_wallet WHERE seller_id = ?', [req.user.id]);
        if (wallet.length === 0) {
            // Create wallet if it doesn't exist (safety net)
            await db.query('INSERT INTO seller_wallet (seller_id, balance, pending_balance) VALUES (?, 0, 0)', [req.user.id]);
            return res.json({ success: true, balance: 0, pending_balance: 0 });
        }

        // Get recent transactions
        const [transactions] = await db.query(
            'SELECT * FROM wallet_transactions WHERE wallet_id = ? ORDER BY created_at DESC LIMIT 20',
            [wallet[0].id]
        );

        res.json({
            success: true,
            balance: wallet[0].balance,
            pending_balance: wallet[0].pending_balance,
            transactions
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};

exports.requestWithdrawal = async (req, res) => {
    try {
        const { amount, bankName, accountNumber } = req.body;

        if (amount <= 0) return res.status(400).json({ success: false, message: 'Invalid amount' });

        const [wallet] = await db.query('SELECT * FROM seller_wallet WHERE seller_id = ?', [req.user.id]);
        if (wallet.length === 0 || wallet[0].balance < amount) {
            return res.status(400).json({ success: false, message: 'Insufficient funds' });
        }

        // Deduct from balance
        await db.query('UPDATE seller_wallet SET balance = balance - ? WHERE id = ?', [amount, wallet[0].id]);

        // Record transaction
        await db.query(
            'INSERT INTO wallet_transactions (wallet_id, type, amount, description, status) VALUES (?, "withdrawal", ?, ?, "pending")',
            [wallet[0].id, amount, `Withdrawal to ${bankName} (${accountNumber})`]
        );

        res.json({ success: true, message: 'Withdrawal request submitted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message || 'Internal server error' });
    }
};
