const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

const cartSelect = `
  SELECT c.id, c.quantity, c.product_article, p.name, p.price::float AS price, p.image_url, p.stock
  FROM cart c JOIN products p ON c.product_article = p.article
  WHERE c.user_id = $1
`;

async function getCart(req, res) {
  const result = await pool.query(`${cartSelect} ORDER BY c.id`, [req.session.userId]);
  const total = result.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  res.json({ items: result.rows, meta: { total } });
}

async function addItem(req, res) {
  const { article } = req.body;
  const quantity = parseInt(req.body.quantity || '1', 10);
  if (!article || Number.isNaN(quantity) || quantity <= 0) throw createHttpError(400, 'article and positive quantity are required');
  const product = await pool.query('SELECT stock FROM products WHERE article = $1', [article]);
  if (product.rows.length === 0) throw createHttpError(404, 'Product not found');
  const stock = product.rows[0].stock;
  const current = await pool.query('SELECT id, quantity FROM cart WHERE user_id = $1 AND product_article = $2', [req.session.userId, article]);
  const newQuantity = (current.rows[0]?.quantity || 0) + quantity;
  if (newQuantity > stock) throw createHttpError(400, 'Not enough product in stock', `Available: ${stock}`);
  let cartId;
  if (current.rows.length) {
    const updated = await pool.query('UPDATE cart SET quantity = $1 WHERE id = $2 RETURNING id', [newQuantity, current.rows[0].id]);
    cartId = updated.rows[0].id;
  } else {
    const inserted = await pool.query('INSERT INTO cart (user_id, product_article, quantity) VALUES ($1, $2, $3) RETURNING id', [req.session.userId, article, quantity]);
    cartId = inserted.rows[0].id;
  }
  await pool.query(`INSERT INTO product_stats (product_article, add_to_cart_count) VALUES ($1, 1) ON CONFLICT (product_article) DO UPDATE SET add_to_cart_count = product_stats.add_to_cart_count + 1`, [article]);
  const item = await pool.query(`${cartSelect} AND c.id = $2`, [req.session.userId, cartId]);
  res.status(201).json(item.rows[0]);
}

async function updateItem(req, res) {
  const quantity = parseInt(req.body.quantity, 10);
  if (Number.isNaN(quantity) || quantity <= 0) throw createHttpError(400, 'positive quantity is required');
  const item = await pool.query(`SELECT c.id, p.stock FROM cart c JOIN products p ON c.product_article = p.article WHERE c.id = $1 AND c.user_id = $2`, [req.params.id, req.session.userId]);
  if (item.rows.length === 0) throw createHttpError(404, 'Cart item not found');
  if (quantity > item.rows[0].stock) throw createHttpError(400, 'Not enough product in stock', `Available: ${item.rows[0].stock}`);
  await pool.query('UPDATE cart SET quantity = $1 WHERE id = $2', [quantity, req.params.id]);
  const result = await pool.query(`${cartSelect} AND c.id = $2`, [req.session.userId, req.params.id]);
  res.json(result.rows[0]);
}

async function deleteItem(req, res) {
  const result = await pool.query('DELETE FROM cart WHERE id = $1 AND user_id = $2', [req.params.id, req.session.userId]);
  if (result.rowCount === 0) throw createHttpError(404, 'Cart item not found');
  res.status(204).send();
}

module.exports = { getCart, addItem, updateItem, deleteItem };
