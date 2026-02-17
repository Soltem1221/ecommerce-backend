const db = require('../config/database');
const { slugify } = require('../utils/helpers');

exports.getCategories = async (req, res) => {
  try {
    const [categories] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM products WHERE category_id = c.id AND is_active = 1) as product_count
      FROM categories c
      WHERE c.is_active = 1
      ORDER BY c.display_order, c.name
    `);
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description, parentId, image_url } = req.body;
    const slug = slugify(name);

    const [result] = await db.query(
      'INSERT INTO categories (name, slug, description, parent_id, image_url) VALUES (?, ?, ?, ?, ?)',
      [name, slug, description, parentId || null, image_url || null]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      categoryId: result.insertId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url } = req.body;

    await db.query(
      'UPDATE categories SET name = ?, description = ?, image_url = ? WHERE id = ?',
      [name, description, image_url || null, id]
    );

    res.json({ success: true, message: 'Category updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM categories WHERE id = ?', [id]);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
};
