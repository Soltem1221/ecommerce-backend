const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ecommerce_db'
};

async function simulate() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        const category = 'electronics';
        const limit = 20;
        const offset = 0;

        let where = ' WHERE p.is_active = 1 AND p.is_approved = 1';
        const params = [];

        if (category) {
            if (!isNaN(parseInt(category))) {
                console.log('Using category ID');
                where += ' AND p.category_id = ?';
                params.push(parseInt(category));
            } else {
                console.log('Using category slug');
                where += ' AND c.slug = ?';
                params.push(category);
            }
        }

        let order = ' ORDER BY p.created_at DESC';

        const query = `
      SELECT p.*, u.name as seller_name, c.name as category_name, b.name as brand_name
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${where}
      ${order}
      LIMIT ? OFFSET ?
    `;

        params.push(parseInt(limit), parseInt(offset));

        console.log('Query:', query);
        console.log('Params:', params);

        const [products] = await connection.query(query, params);
        console.log('\nSuccess! Found products:', products.length);
        if (products.length > 0) console.log(products[0]);

    } catch (error) {
        console.error('\nERROR:', error);
    } finally {
        await connection.end();
    }
}

simulate();
