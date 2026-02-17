const axios = require('axios');
require('dotenv').config();

const testChapa = async () => {
    const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;
    console.log('Testing with key:', CHAPA_SECRET_KEY ? (CHAPA_SECRET_KEY.substring(0, 15) + '...') : 'MISSING');

    try {
        const response = await axios.post('https://api.chapa.co/v1/transaction/initialize', {
            amount: 100,
            currency: 'ETB',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            tx_ref: 'test-' + Date.now(),
            callback_url: 'http://localhost:5000',
            return_url: 'http://localhost:5173'
        }, {
            headers: {
                Authorization: `Bearer ${CHAPA_SECRET_KEY}`
            }
        });
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error Status:', error.response?.status);
        console.error('Error Data:', error.response?.data);
        console.error('Error Message:', error.message);
    }
};

testChapa();
