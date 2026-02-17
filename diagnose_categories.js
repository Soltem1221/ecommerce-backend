const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_db'
};

async function diagnose() {
    const connection = await mysql.createConnection(dbConfig);

    try {
        console.log('--- CATEGORIES ---');
        const [categories] = await connection.query('SELECT id, name, slug FROM categories');
        console.table(categories);

        console.log('\n--- PRODUCTS ---');
        const [products] = await connection.query('SELECT id, name, category_id, is_active, is_approved FROM products');
        console.table(products);

        console.log('\n--- PRODUCTS WITH CATEGORY DETAILS ---');
        const [joined] = await connection.query(`
      SELECT p.id, p.name, p.category_id, c.name as cat_name, c.slug as cat_slug 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
    `);
        console.table(joined);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await connection.end();
    }
}

diagnose();
