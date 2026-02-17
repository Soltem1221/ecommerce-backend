const db = require('../config/database');

exports.getWishlist = async (req, res) => {
  try {
    const [items] = await db.query(`
      SELECT w.*, p.name, p.slug, p.price, p.discount_price,
             (SELECT image_url FROM product_images WHERE product_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, wishlist: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    await db.query(
      'INSERT INTO wishlist (user_id, product_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE product_id = product_id',
      [req.user.id, productId]
    );

    res.json({ success: true, message: 'Added to wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    await db.query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, productId]);

    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
