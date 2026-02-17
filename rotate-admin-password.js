require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function rotateAdminPassword() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Generate a secure random password (12 chars, hex)
    const newPassword = crypto.randomBytes(8).toString('hex');
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update admin user's password (match by email)
    const [result] = await connection.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashed, 'sol@gmail.com']
    );

    if (result.affectedRows === 0) {
      console.error('No user found with email sol@gmail.com. No changes made.');
      process.exit(2);
    }

    console.log('✓ Admin password rotated successfully.');
    console.log('\nNew admin credentials:');
    console.log('Email: sol@gmail.com');
    console.log('Password:', newPassword);
    console.log('\nPlease store this password securely and change it after first login.');

    await connection.end();
  } catch (err) {
    console.error('Error rotating admin password:', err.message);
    process.exit(1);
  }
}

rotateAdminPassword();
