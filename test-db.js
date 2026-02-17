require('dotenv').config();
const mysql = require('mysql2/promise');

async function testConnection() {
  console.log('Testing MySQL Connection...\n');
  console.log('Configuration:');
  console.log('- Host:', process.env.DB_HOST);
  console.log('- User:', process.env.DB_USER);
  console.log('- Database:', process.env.DB_NAME);
  console.log('- Password:', process.env.DB_PASSWORD ? '***SET***' : '***EMPTY***');
  console.log('\nConnecting...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('✓ Connection successful!');
    
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM users');
    console.log(`✓ Database accessible - Found ${rows[0].count} users`);
    
    await connection.end();
    console.log('\n✓ All tests passed! Your database is ready.');
  } catch (error) {
    console.error('\n✗ Connection failed!');
    console.error('Error:', error.message);
    console.log('\nPossible solutions:');
    console.log('1. Check if MySQL is running');
    console.log('2. Verify DB_PASSWORD in backend/.env');
    console.log('3. Ensure database "ecommerce_marketplace" exists');
    console.log('4. Check MySQL user permissions');
  }
}

testConnection();
