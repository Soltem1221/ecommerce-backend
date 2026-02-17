const db = require('../config/database');
const { slugify, generateSKU } = require('../utils/helpers');

async function seed() {
  try {
    // find a seller user, fallback to admin
    const [sellers] = await db.query("SELECT id, role FROM users WHERE role = 'seller' LIMIT 1");
    let sellerId;
    if (sellers.length > 0) sellerId = sellers[0].id;
    else {
      const [admins] = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
      if (admins.length === 0) throw new Error('No seller or admin user found to assign product to');
      sellerId = admins[0].id;
    }

    const name = 'Seeded Demo T-Shirt ' + Date.now();
    const description = 'Demo seeded product for testing featured and create-product flows.';
    const categoryId = 1;
    const brandId = null;
    const price = 199.99;
    const discountPrice = 149.99;
    const stockQuantity = 50;
    const weight = 0.3;
    const dimensions = '30 x 20 x 2';

    let slug = slugify(name);
    let sku = generateSKU(name);

    // ensure unique
    let suffix = 0;
    while (true) {
      const [rows] = await db.query('SELECT id FROM products WHERE slug = ?', [slug]);
      if (rows.length === 0) break;
      suffix += 1;
      slug = `${slug}-${suffix}`;
    }

    suffix = 0;
    while (true) {
      const [rows] = await db.query('SELECT id FROM products WHERE sku = ?', [sku]);
      if (rows.length === 0) break;
      suffix += 1;
      sku = `${sku}${suffix}`;
    }

    const [result] = await db.query(`
      INSERT INTO products (seller_id, category_id, brand_id, name, slug, description, sku, price, discount_price, stock_quantity, weight, dimensions, is_featured, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `, [sellerId, categoryId, brandId, name, slug, description, sku, price, discountPrice, stockQuantity, weight, dimensions]);

    const productId = result.insertId;
    await db.query('INSERT INTO product_images (product_id, image_url, is_primary) VALUES (?, ?, 1)', [productId, 'https://picsum.photos/800/600?random=' + productId]);

    console.log('Seeded product id:', productId);
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message || err);
    process.exit(1);
  }
}

seed();
