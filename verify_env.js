const fs = require('fs');
const dotenv = require('dotenv');
const result = dotenv.config();

if (result.error) {
    console.error('Dotenv Error:', result.error);
}

const keys = ['CHAPA_SECRET_KEY', 'CHAPA_PUBLIC_KEY', 'DB_NAME', 'PORT'];
keys.forEach(key => {
    const val = process.env[key];
    if (val) {
        console.log(`${key}: [${val}] (Length: ${val.length})`);
        if (val.trim() !== val) {
            console.log(`WARNING: ${key} has leading/trailing whitespace!`);
        }
    } else {
        console.log(`${key}: MISSING`);
    }
});
