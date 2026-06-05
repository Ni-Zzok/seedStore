const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

async function isAdmin(userId) {
  const result = await pool.query('SELECT role FROM users WHERE id = $1', [userId]);
  return result.rows[0]?.role === 'admin';
}

async function loadOrder(orderId, userId, allowAdmin = false) {
  const admin = allowAdmin ? await isAdmin(userId) : false;
  const orderResult = await pool.query(`
    SELECT id, user_id, total_price::float AS total_price, status, shipping_address, payment_method, created_at
    FROM orders WHERE id = $1 ${admin ? '' : 'AND user_id = $2'}
  `, admin ? [orderId] : [orderId, userId]);
  if (orderResult.rows.length === 0) throw createHttpError(404, 'Order not found');
  const itemsResult = await pool.query(`
    SELECT oi.id, oi.quantity, oi.price_at_time::float AS price_at_time, oi.product_article, p.name AS product_name
    FROM order_items oi JOIN products p ON oi.product_article = p.article
    WHERE oi.order_id = $1 ORDER BY oi.id
  `, [orderId]);
  return { ...orderResult.rows[0], items: itemsResult.rows };
}

async function listOrders(req, res) {
  const result = await pool.query(`
    SELECT id, user_id, total_price::float AS total_price, status, shipping_address, payment_method, created_at
    FROM orders WHERE user_id = $1 ORDER BY created_at DESC
  `, [req.session.userId]);
  res.json({ items: result.rows });
}

async function getOrder(req, res) {
  res.json(await loadOrder(req.params.id, req.session.userId, true));
}

async function createOrder(req, res) {
  const shippingAddress = req.body.shippingAddress || req.body.shipping_address;
  if (!shippingAddress) throw createHttpError(400, 'shippingAddress is required');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cart = await client.query(`
      SELECT c.quantity, p.article, p.name, p.price::float AS price, p.stock
      FROM cart c JOIN products p ON c.product_article = p.article
      WHERE c.user_id = $1 FOR UPDATE
    `, [req.session.userId]);
    if (cart.rows.length === 0) throw createHttpError(400, 'Cart is empty');
    for (const item of cart.rows) {
      if (item.quantity > item.stock) throw createHttpError(400, `Not enough product in stock: ${item.name}`, `Available: ${item.stock}`);
    }
    const total = cart.rows.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0).toFixed(2);
    const order = await client.query(`
      INSERT INTO orders (user_id, total_price, status, shipping_address, payment_method, created_at)
      VALUES ($1, $2, 'pending', $3, 'pending_payment', CURRENT_TIMESTAMP)
      RETURNING id
    `, [req.session.userId, total, shippingAddress]);
    for (const item of cart.rows) {
      await client.query('INSERT INTO order_items (order_id, quantity, price_at_time, product_article) VALUES ($1, $2, $3, $4)', [order.rows[0].id, item.quantity, item.price, item.article]);
      await client.query('UPDATE products SET stock = stock - $1 WHERE article = $2', [item.quantity, item.article]);
    }
    await client.query('DELETE FROM cart WHERE user_id = $1', [req.session.userId]);
    await client.query('COMMIT');
    res.status(201).json(await loadOrder(order.rows[0].id, req.session.userId));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateStatus(req, res) {
  const { status } = req.body;
  if (!status) throw createHttpError(400, 'status is required');
  const result = await pool.query(`
    UPDATE orders SET status = $1 WHERE id = $2
    RETURNING id, user_id, total_price::float AS total_price, status, shipping_address, payment_method, created_at
  `, [status, req.params.id]);
  if (result.rows.length === 0) throw createHttpError(404, 'Order not found');
  res.json(result.rows[0]);
}

module.exports = { listOrders, getOrder, createOrder, updateStatus };
