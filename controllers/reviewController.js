const db = require('../config/database');

exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const [reviews] = await db.query(`
      SELECT r.*, u.name as user_name, u.profile_image
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ? AND r.is_approved = 1
      ORDER BY r.created_at DESC
    `, [productId]);

    const [[stats]] = await db.query(`
      SELECT 
        AVG(rating) as avg_rating,
        COUNT(*) as total_reviews,
        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
    `, [productId]);

    res.json({ success: true, reviews, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.createReview = async (req, res) => {
  try {
    const { productId, orderId, rating, title, comment } = req.body;

    // Check if user purchased the product
    const [orders] = await db.query(`
      SELECT o.id FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_id = ? AND oi.product_id = ? AND o.status = 'delivered'
    `, [req.user.id, productId]);

    if (orders.length === 0) {
      return res.status(400).json({ success: false, message: 'You can only review purchased products' });
    }

    await db.query(
      'INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [productId, req.user.id, orderId, rating, title, comment]
    );

    res.status(201).json({ success: true, message: 'Review submitted successfully' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'You have already reviewed this product' });
    }
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, title, comment } = req.body;

    const [reviews] = await db.query('SELECT user_id FROM reviews WHERE id = ?', [id]);
    if (reviews.length === 0 || reviews[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query(
      'UPDATE reviews SET rating = ?, title = ?, comment = ? WHERE id = ?',
      [rating, title, comment, id]
    );

    res.json({ success: true, message: 'Review updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    const [reviews] = await db.query('SELECT user_id FROM reviews WHERE id = ?', [id]);
    if (reviews.length === 0 || reviews[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await db.query('DELETE FROM reviews WHERE id = ?', [id]);

    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
