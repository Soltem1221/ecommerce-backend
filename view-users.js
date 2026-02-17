require('dotenv').config();
const mysql = require('mysql2/promise');

async function viewUsers() {
  console.log('Fetching registered users...\n');

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // Get all users
    const [users] = await connection.query(`
      SELECT id, name, email, phone, role, is_verified, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('                    REGISTERED USERS');
    console.log('═══════════════════════════════════════════════════════════\n');

    if (users.length === 0) {
      console.log('No users found in database.');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone || 'N/A'}`);
        console.log(`   Role: ${user.role.toUpperCase()}`);
        console.log(`   Status: ${user.is_active ? 'Active' : 'Inactive'}`);
        console.log(`   Verified: ${user.is_verified ? 'Yes' : 'No'}`);
        console.log(`   Registered: ${user.created_at}`);
        console.log('   ─────────────────────────────────────────────────────');
      });

      // Summary
      const [stats] = await connection.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN role = 'customer' THEN 1 ELSE 0 END) as customers,
          SUM(CASE WHEN role = 'seller' THEN 1 ELSE 0 END) as sellers,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins
        FROM users
      `);

      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('                        SUMMARY');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`Total Users: ${stats[0].total}`);
      console.log(`Customers: ${stats[0].customers}`);
      console.log(`Sellers: ${stats[0].sellers}`);
      console.log(`Admins: ${stats[0].admins}`);
      console.log('═══════════════════════════════════════════════════════════\n');
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

viewUsers();
