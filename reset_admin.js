const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const resetAdminPassword = async () => {
    const newPassword = 'admin123';
    const email = 'sol@gmail.com';

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [result] = await connection.execute(
            'UPDATE users SET password = ? WHERE email = ? AND role = "admin"',
            [hashedPassword, email]
        );

        if (result.affectedRows > 0) {
            console.log(`Successfully reset password for ${email} to: ${newPassword}`);
        } else {
            console.log(`Admin user with email ${email} not found.`);
        }

        await connection.end();
    } catch (error) {
        console.error('Error resetting password:', error);
    }
};

resetAdminPassword();
