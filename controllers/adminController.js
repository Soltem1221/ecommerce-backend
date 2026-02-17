const db = require('../config/database');

exports.getDashboardStats = async (req, res) => {
  try {
    const [[users]] = await db.query('SELECT COUNT(*) as total FROM users WHERE role = "customer"');
    const [[sellers]] = await db.query('SELECT COUNT(*) as total FROM users WHERE role = "seller" AND is_active = 1');
    const [[products]] = await db.query('SELECT COUNT(*) as total FROM products WHERE is_active = 1');
    const [[orders]] = await db.query('SELECT COUNT(*) as total, SUM(total) as revenue FROM orders');
    const [[pending]] = await db.query('SELECT COUNT(*) as total FROM seller_details WHERE is_approved = 0');

    res.json({
      success: true,
      stats: {
        totalUsers: users.total,
        totalSellers: sellers.total,
        totalProducts: products.total,
        totalOrders: orders.total,
        totalRevenue: orders.revenue || 0,
        pendingApprovals: pending.total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT id, email, name, phone, role, is_verified, is_active, created_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getPendingSellers = async (req, res) => {
  try {
    const [sellers] = await db.query(`
      SELECT u.id, u.email, u.name, sd.business_name, sd.business_email, sd.created_at
      FROM users u
      JOIN seller_details sd ON u.id = sd.user_id
      WHERE sd.is_approved = 0
      ORDER BY sd.created_at DESC
    `);
    res.json({ success: true, sellers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.approveSeller = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE seller_details SET is_approved = 1, approval_date = NOW() WHERE user_id = ?', [id]);
    res.json({ success: true, message: 'Seller approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.rejectSeller = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM seller_details WHERE user_id = ?', [id]);
    await db.query('UPDATE users SET role = "customer" WHERE id = ?', [id]);
    res.json({ success: true, message: 'Seller rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = ?', [id]);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.approveProduct = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE products SET is_approved = 1 WHERE id = ?', [id]);
    res.json({ success: true, message: 'Product approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.query(`
      SELECT o.*, u.name as customer_name, u.email as customer_email,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as items_count
      FROM orders o
      LEFT JOIN users u ON o.customer_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Order status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.getSystemReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let query = `
            SELECT DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders
            FROM orders
        `;
    const params = [];

    if (startDate && endDate) {
      query += ` WHERE created_at BETWEEN ? AND ? `;
      params.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
    } else {
      query += ` WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) `;
    }

    query += `
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        `;

    const [dailySales] = await db.query(query, params);

    res.json({ success: true, reports: { dailySales } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.toggleFeatured = async (req, res) => {
  try {
    const { id } = req.params;
    // Toggle the is_featured status
    await db.query('UPDATE products SET is_featured = NOT is_featured WHERE id = ?', [id]);

    // Get the new status to return
    const [products] = await db.query('SELECT is_featured FROM products WHERE id = ?', [id]);
    const isFeatured = products[0]?.is_featured;

    res.json({
      success: true,
      message: isFeatured ? 'Product added to featured' : 'Product removed from featured',
      isFeatured
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
