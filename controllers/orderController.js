const db = require('../config/database');
const { generateOrderNumber } = require('../utils/helpers');

exports.createOrder = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { shippingAddress, paymentMethod, items } = req.body;
    console.log('--- Creating Order ---');
    console.log('User ID:', req.user.id);
    console.log('Request Body:', JSON.stringify(req.body, null, 2));

    const [addressResult] = await connection.query(
      'INSERT INTO addresses (user_id, full_name, phone, address_line, city, state, postal_code) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, shippingAddress.fullName, shippingAddress.phone, shippingAddress.addressLine,
      shippingAddress.city, shippingAddress.state, shippingAddress.postalCode]
    );

    let subtotal = 0;
    for (const item of items) {
      const [products] = await connection.query('SELECT price, discount_price, stock_quantity FROM products WHERE id = ?', [item.productId]);
      if (products.length === 0) {
        throw new Error(`Product with ID ${item.productId} not found`);
      }
      if (products[0].stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}. Available: ${products[0].stock_quantity}, Requested: ${item.quantity}`);
      }
      const price = products[0].discount_price || products[0].price;
      subtotal += price * item.quantity;
    }

    const shippingCost = 50;
    const total = subtotal + shippingCost;
    const orderNumber = generateOrderNumber();

    console.log('Inserting order into database...');
    const [orderResult] = await connection.query(
      'INSERT INTO orders (order_number, customer_id, shipping_address_id, subtotal, shipping_cost, total, payment_method, payment_status, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, req.user.id, addressResult.insertId, subtotal, shippingCost, total, paymentMethod, 'pending', 'pending']
    );

    for (const item of items) {
      const [products] = await connection.query('SELECT seller_id, name, sku, price, discount_price FROM products WHERE id = ?', [item.productId]);
      const product = products[0];
      const price = product.discount_price || product.price;

      await connection.query(
        'INSERT INTO order_items (order_id, product_id, seller_id, product_name, sku, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [orderResult.insertId, item.productId, product.seller_id, product.name, product.sku, item.quantity, price, price * item.quantity]
      );

      await connection.query('UPDATE products SET stock_quantity = stock_quantity - ?, sales_count = sales_count + ? WHERE id = ?',
        [item.quantity, item.quantity, item.productId]);
    }

    await connection.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    await connection.commit();

    console.log('Order created successfully:', orderNumber);
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      orderId: orderResult.insertId,
      orderNumber
    });
  } catch (error) {
    console.error('--- Order Creation Error ---');
    console.error('Error:', error);
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  } finally {
    connection.release();
  }
};

exports.getOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, a.address_line, a.city, a.phone,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      LEFT JOIN addresses a ON o.shipping_address_id = a.id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const [orders] = await db.query(`
      SELECT o.*, a.full_name, a.phone, a.address_line, a.city, a.state, a.postal_code
      FROM orders o
      LEFT JOIN addresses a ON o.shipping_address_id = a.id
      WHERE o.id = ? AND o.customer_id = ?
    `, [id, req.user.id]);

    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const [items] = await db.query(`
      SELECT oi.*, p.slug, 
             (SELECT image_url FROM product_images WHERE product_id = oi.product_id AND is_primary = 1 LIMIT 1) as image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [id]);

    res.json({ success: true, order: { ...orders[0], items } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getSellerOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.id, o.order_number, o.created_at, o.status, o.payment_status,
             oi.product_name, oi.quantity, oi.price, oi.subtotal,
             a.full_name as customer_name
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN addresses a ON o.shipping_address_id = a.id
      WHERE oi.seller_id = ?
      ORDER BY o.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
