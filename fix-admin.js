require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function fixAdminPassword() {
  console.log('Fixing admin password...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Hash the new password
    const newPassword = '1234';
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update admin user: change email and password from default admin@ecommerce.com
    await connection.query(
      'UPDATE users SET email = ?, password = ? WHERE email = ?',
      ['sol@gmail.com', hashedPassword, 'admin@ecommerce.com']
    );

    console.log('✓ Admin credentials updated successfully!');
    console.log('\nAdmin credentials:');
    console.log('Email: sol@gmail.com');
    console.log('Password: 1234');
    console.log('\nYou can now login with these credentials.');

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixAdminPassword();
