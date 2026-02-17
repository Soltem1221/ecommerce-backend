const db = require('../config/database');
const { slugify, generateSKU } = require('../utils/helpers');

exports.getProducts = async (req, res) => {
  try {
    const { category, brand, minPrice, maxPrice, search, sort, page = 1, limit = 20, featured, sale } = req.query;
    const offset = (page - 1) * limit;

    let where = ' WHERE p.is_active = 1 AND p.is_approved = 1';
    const params = [];

    if (category) {
      // accept either numeric category id or category slug
      if (!isNaN(parseInt(category))) {
        where += ' AND p.category_id = ?';
        params.push(parseInt(category));
      } else {
        // filter by category slug via joined categories table
        where += ' AND c.slug = ?';
        params.push(category);
      }
    }

    if (brand) {
      where += ' AND p.brand_id = ?';
      params.push(brand);
    }

    if (minPrice) {
      where += ' AND p.price >= ?';
      params.push(minPrice);
    }

    if (maxPrice) {
      where += ' AND p.price <= ?';
      params.push(maxPrice);
    }

    if (search) {
      where += ' AND (p.name LIKE ? OR p.description LIKE ? OR u.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (featured === 'true' || featured === '1' || featured === true) {
      where += ' AND p.is_featured = 1';
    }

    if (sale === 'true' || sale === '1' || sale === true) {
      where += ' AND (p.discount_price IS NOT NULL AND p.discount_price < p.price)';
    }

    let order = ' ORDER BY p.created_at DESC';
    if (sort === 'price_asc') order = ' ORDER BY p.price ASC';
    else if (sort === 'price_desc') order = ' ORDER BY p.price DESC';
    else if (sort === 'newest') order = ' ORDER BY p.created_at DESC';
    else if (sort === 'popular' || sort === 'best_sellers') order = ' ORDER BY p.sales_count DESC';

    const query = `
      SELECT p.*, u.name as seller_name, c.name as category_name, b.name as brand_name,
             (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as primary_image,
             (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating,
             (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${where}
      ${order}
      LIMIT ? OFFSET ?
    `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('DEBUG getProducts:', { category, where, params });

    const [products] = await db.query(query, params);

    // count with same where conditions
    // count with same where conditions
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      ${where}
    `;
    const [[{ total }]] = await db.query(countQuery, params.slice(0, params.length - 2));

    res.json({
      success: true,
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error', error: error.message });
  }
};

exports.getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const [products] = await db.query(`
      SELECT p.*, u.name as seller_name, u.id as seller_id, c.name as category_name, b.name as brand_name,
             (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating,
             (SELECT COUNT(*) FROM reviews WHERE product_id = p.id) as review_count
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE p.slug = ? AND p.is_active = 1
    `, [slug]);

    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = products[0];

    const [images] = await db.query('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, display_order', [product.id]);
    const [variants] = await db.query('SELECT * FROM product_variants WHERE product_id = ?', [product.id]);
    const [attributes] = await db.query('SELECT * FROM product_attributes WHERE product_id = ?', [product.id]);
    const [reviews] = await db.query(`
      SELECT r.*, u.name as user_name FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC LIMIT 10
    `, [product.id]);

    await db.query('UPDATE products SET views_count = views_count + 1 WHERE id = ?', [product.id]);

    res.json({
      success: true,
      product: { ...product, images, variants, attributes, reviews }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.createProduct = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });

    let { name, description, categoryId, brandId, price, discountPrice, stockQuantity, weight, dimensions } = req.body;

    // basic validation
    if (!name || !description || !categoryId || price == null || price === '') {
      return res.status(400).json({ success: false, message: 'Missing required fields: name, description, categoryId, price' });
    }

    // cast numeric fields
    price = parseFloat(price);
    discountPrice = discountPrice === '' || discountPrice == null ? null : parseFloat(discountPrice);
    stockQuantity = stockQuantity == null || stockQuantity === '' ? 0 : parseInt(stockQuantity);
    weight = weight == null || weight === '' ? null : parseFloat(weight);

    // normalize numeric inputs
    categoryId = parseInt(categoryId);

    // resolve brand: accept either an existing id or a brand name string
    let resolvedBrandId = null;
    if (brandId !== null && brandId !== undefined && brandId !== '') {
      // if brandId is numeric string or number, use as id
      if (!isNaN(parseInt(brandId))) {
        resolvedBrandId = parseInt(brandId);
      } else {
        // try to find brand by name, otherwise create it
        const brandName = String(brandId).trim();
        const [found] = await db.query('SELECT id FROM brands WHERE name = ? LIMIT 1', [brandName]);
        if (found && found.length > 0) {
          resolvedBrandId = found[0].id;
        } else {
          const brandSlug = slugify(brandName);
          const [inserted] = await db.query('INSERT INTO brands (name, slug) VALUES (?, ?)', [brandName, brandSlug]);
          resolvedBrandId = inserted.insertId;
        }
      }
    }

    // generate unique slug and sku (avoid duplicate key errors)
    let slug = slugify(name);
    let sku = generateSKU(name);

    // ensure slug unique
    let suffix = 0;
    while (true) {
      const [rows] = await db.query('SELECT id FROM products WHERE slug = ?', [slug]);
      if (rows.length === 0) break;
      suffix += 1;
      slug = `${slug}-${suffix}`;
    }

    // ensure sku unique
    suffix = 0;
    while (true) {
      const [rows] = await db.query('SELECT id FROM products WHERE sku = ?', [sku]);
      if (rows.length === 0) break;
      suffix += 1;
      sku = `${sku}${suffix}`;
    }

    try {
      // auto-approve products created by sellers/admin so they appear in listings immediately
      const isApproved = (req.user.role === 'admin' || req.user.role === 'seller') ? 1 : 0;
      const [result] = await db.query(`
        INSERT INTO products (seller_id, category_id, brand_id, name, slug, description, sku, price, discount_price, stock_quantity, weight, dimensions, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.user.id, categoryId, resolvedBrandId || null, name, slug, description, sku, price, discountPrice || null, stockQuantity, weight, dimensions, isApproved]);

      return res.status(201).json({ success: true, message: 'Product created successfully', productId: result.insertId });
    } catch (sqlErr) {
      // handle duplicate entry or other sql errors gracefully
      if (sqlErr && sqlErr.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A product with the same SKU or slug already exists. Try a different name.' });
      }
      console.error('createProduct error:', sqlErr);
      return res.status(500).json({ success: false, message: sqlErr.message || 'Internal server error', error: sqlErr.message });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error', error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, categoryId, brandId, price, discountPrice, stockQuantity, weight, dimensions } = req.body;

    const [products] = await db.query('SELECT seller_id FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (products[0].seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query(`
      UPDATE products SET name = ?, description = ?, category_id = ?, brand_id = ?, 
      price = ?, discount_price = ?, stock_quantity = ?, weight = ?, dimensions = ? WHERE id = ?
    `, [name, description, categoryId, brandId, price, discountPrice, stockQuantity, weight, dimensions, id]);

    res.json({ success: true, message: 'Product updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const [products] = await db.query('SELECT seller_id FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (products[0].seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    // only admins should call this (route protected by authorize middleware)
    const [products] = await db.query('SELECT id, is_approved FROM products WHERE id = ?', [id]);
    if (products.length === 0) return res.status(404).json({ success: false, message: 'Product not found' });

    if (products[0].is_approved === 1) {
      return res.json({ success: true, message: 'Product already approved' });
    }

    await db.query('UPDATE products SET is_approved = 1 WHERE id = ?', [id]);

    // optionally, you could notify the seller here

    res.json({ success: true, message: 'Product approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
