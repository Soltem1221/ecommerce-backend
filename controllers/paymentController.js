const axios = require('axios');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || 'CHASECK_TEST-xxxxxxxxxxxxxxxxxxxx'; // Replace with env var in prod
const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction';

console.log('--- Payment Controller Loaded ---');
console.log('Chapa Key:', CHAPA_SECRET_KEY ? (CHAPA_SECRET_KEY.substring(0, 10) + '...') : 'MISSING');
console.log('API URL:', CHAPA_API_URL);
console.log('---------------------------------');

exports.initializePayment = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Check if Chapa key is still the placeholder
        if (CHAPA_SECRET_KEY === 'your_chapa_secret_key' || CHAPA_SECRET_KEY.includes('xxxx')) {
            return res.status(400).json({
                success: false,
                message: 'Chapa API Key is not configured. Please add your CHAPA_SECRET_KEY to the backend .env file.'
            });
        }

        // Get order details
        const [orders] = await db.query('SELECT * FROM orders WHERE id = ? AND customer_id = ?', [orderId, req.user.id]);
        if (orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const order = orders[0];

        // Get customer details
        const [users] = await db.query('SELECT email, name, phone FROM users WHERE id = ?', [req.user.id]);
        const user = users[0];

        // Prepare Chapa payload
        const tx_ref = `tx-${order.order_number}-${uuidv4().split('-')[0]}`;
        const payload = {
            amount: order.total,
            currency: 'ETB',
            email: user.email,
            first_name: user.name.split(' ')[0],
            last_name: user.name.split(' ').slice(1).join(' ') || 'User',
            tx_ref: tx_ref,
            callback_url: process.env.CHAPA_CALLBACK_URL || `${process.env.API_URL || 'http://localhost:5000/api'}/payment/callback`,
            return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success/${order.id}`,
            customization: {
                title: 'Order Payment',
                description: `Payment for Order ${order.order_number}`
            }
        };

        console.log('--- Chapa Payment Initialization ---');
        console.log('Order ID:', orderId);
        console.log('Payload:', JSON.stringify(payload, null, 2));
        console.log('Using Secret Key:', CHAPA_SECRET_KEY ? (CHAPA_SECRET_KEY.substring(0, 15) + '...') : 'MISSING');

        // Update order with transaction reference
        await db.query('UPDATE orders SET transaction_ref = ? WHERE id = ?', [tx_ref, order.id]);

        // Call Chapa API
        console.log('Initializing Chapa payment with ref:', tx_ref);
        const response = await axios.post(`${CHAPA_API_URL}/initialize`, payload, {
            headers: {
                Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Chapa Response Status:', response.status);
        console.log('Chapa Response Body:', JSON.stringify(response.data, null, 2));

        if (response.data.status === 'success') {
            res.json({
                success: true,
                checkout_url: response.data.data.checkout_url
            });
        } else {
            res.status(400).json({ success: false, message: 'Chapa failed to initialize the transaction' });
        }

    } catch (error) {
        const errorData = error.response?.data;
        console.error('--- Chapa Init Error ---');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(errorData, null, 2) || error.message);
        console.error('Config URL:', error.config?.url);
        console.error('Config Data:', error.config?.data);

        let userMessage = 'Payment initialization failed';
        const errorMessage = errorData?.message;

        if (errorMessage) {
            if (typeof errorMessage === 'string') {
                if (errorMessage.includes('Invalid key')) {
                    userMessage = 'Invalid Chapa API Key. Please check your .env configuration.';
                } else {
                    userMessage = `Chapa Error: ${errorMessage}`;
                }
            } else {
                // message is an object or array (like the validation error)
                userMessage = `Chapa Error: ${JSON.stringify(errorMessage)}`;
            }
        }

        res.status(500).json({ success: false, message: userMessage });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { tx_ref } = req.params;

        // Call Chapa API to verify
        const response = await axios.get(`${CHAPA_API_URL}/verify/${tx_ref}`, {
            headers: {
                Authorization: `Bearer ${CHAPA_SECRET_KEY}`
            }
        });

        if (response.data.status === 'success') {
            // Update order status
            await db.query('UPDATE orders SET status = ?, payment_status = ? WHERE transaction_ref = ?',
                ['processing', 'paid', tx_ref]);

            res.json({ success: true, message: 'Payment verified successfully', data: response.data.data });
        } else {
            res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

    } catch (error) {
        console.error('Chapa Verify Error:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Payment verification failed' });
    }
};

exports.handleWebhook = async (req, res) => {
    // Verify webhook signature here if needed
    const event = req.body;

    if (event.event === 'charge.success') {
        const tx_ref = event.data.tx_ref;
        await db.query('UPDATE orders SET status = ?, payment_status = ? WHERE transaction_ref = ?',
            ['processing', 'paid', tx_ref]);
    }

    res.sendStatus(200);
};
