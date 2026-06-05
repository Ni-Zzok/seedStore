const pool = require('../db/pool');

async function getRootCategories() {
  const result = await pool.query(`
    SELECT id, name, image_url
    FROM categories
    WHERE parent_id IS NULL
    ORDER BY name
  `);
  return result.rows;
}

async function getAllCategories() {
  const result = await pool.query(`
    SELECT id, name
    FROM categories
    ORDER BY name
  `);
  return result.rows;
}

async function getProductPageByArticle(article) {
  const result = await pool.query(`
    SELECT p.article, p.name, p.description, p.image_url, p.price, p.stock, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.article = $1
  `, [article]);
  return result.rows[0] || null;
}

async function getCartItems(userId) {
  const result = await pool.query(`
    SELECT c.id, c.quantity, p.article, p.name, p.price, p.image_url, p.stock
    FROM cart c
    JOIN products p ON c.product_article = p.article
    WHERE c.user_id = $1
  `, [userId]);
  return result.rows;
}

async function getUserAddress(userId) {
  const result = await pool.query('SELECT address FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.address || null;
}

module.exports = {
  getRootCategories,
  getAllCategories,
  getProductPageByArticle,
  getCartItems,
  getUserAddress
};
