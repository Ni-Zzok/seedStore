const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

const supplySelect = `
  SELECT s.id, s.supplier_id, sp.name AS supplier_name, s.product_article, p.name AS product_name,
         s.quantity, s.supply_date, s.price_per_unit::float AS price_per_unit,
         s.total_cost::float AS total_cost, s.created_at
  FROM supplies s
  JOIN suppliers sp ON s.supplier_id = sp.id
  JOIN products p ON s.product_article = p.article
`;

async function assertRefs(supplierId, productArticle) {
  if (supplierId) {
    const supplier = await pool.query('SELECT id FROM suppliers WHERE id = $1', [supplierId]);
    if (supplier.rows.length === 0) throw createHttpError(400, 'Supplier not found');
  }
  if (productArticle) {
    const product = await pool.query('SELECT article FROM products WHERE article = $1', [productArticle]);
    if (product.rows.length === 0) throw createHttpError(400, 'Product not found');
  }
}

async function listSupplies(req, res) {
  const { supplierId, productArticle, dateFrom, dateTo } = req.query;
  const conditions = [];
  const values = [];
  if (supplierId) { values.push(supplierId); conditions.push(`s.supplier_id = $${values.length}`); }
  if (productArticle) { values.push(productArticle); conditions.push(`s.product_article = $${values.length}`); }
  if (dateFrom) { values.push(dateFrom); conditions.push(`s.supply_date >= $${values.length}`); }
  if (dateTo) { values.push(dateTo); conditions.push(`s.supply_date <= $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(`${supplySelect} ${where} ORDER BY s.supply_date DESC, s.id DESC`, values);
  res.json({ items: result.rows });
}

async function getSupply(req, res) {
  const result = await pool.query(`${supplySelect} WHERE s.id = $1`, [req.params.id]);
  if (result.rows.length === 0) throw createHttpError(404, 'Supply not found');
  res.json(result.rows[0]);
}

async function createSupply(req, res) {
  const supplierId = req.body.supplier_id || req.body.supplierId;
  const productArticle = req.body.product_article || req.body.productArticle;
  const quantity = Number(req.body.quantity);
  const pricePerUnit = Number(req.body.price_per_unit || req.body.pricePerUnit);
  const supplyDate = req.body.supply_date || req.body.supplyDate || new Date().toISOString().slice(0, 10);
  const totalCost = req.body.total_cost || req.body.totalCost || (quantity * pricePerUnit).toFixed(2);
  if (!supplierId || !productArticle || !quantity || !pricePerUnit) throw createHttpError(400, 'supplier_id, product_article, quantity and price_per_unit are required');
  await assertRefs(supplierId, productArticle);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      INSERT INTO supplies (supplier_id, quantity, supply_date, price_per_unit, total_cost, product_article, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING id
    `, [supplierId, quantity, supplyDate, pricePerUnit, totalCost, productArticle]);
    await client.query('UPDATE products SET stock = stock + $1 WHERE article = $2', [quantity, productArticle]);
    await client.query('COMMIT');
    const supply = await pool.query(`${supplySelect} WHERE s.id = $1`, [result.rows[0].id]);
    res.status(201).json(supply.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateSupply(req, res) {
  const allowed = { supplier_id: 'supplier_id', supplierId: 'supplier_id', quantity: 'quantity', supply_date: 'supply_date', supplyDate: 'supply_date', price_per_unit: 'price_per_unit', pricePerUnit: 'price_per_unit', total_cost: 'total_cost', totalCost: 'total_cost', product_article: 'product_article', productArticle: 'product_article' };
  const updates = [];
  const values = [];
  const supplierId = req.body.supplier_id || req.body.supplierId;
  const productArticle = req.body.product_article || req.body.productArticle;
  await assertRefs(supplierId, productArticle);
  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      values.push(req.body[key]);
      updates.push(`${column} = $${values.length}`);
    }
  }
  if (updates.length === 0) throw createHttpError(400, 'No fields to update');
  values.push(req.params.id);
  const result = await pool.query(`UPDATE supplies SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id`, values);
  if (result.rows.length === 0) throw createHttpError(404, 'Supply not found');
  return getSupply(req, res);
}

async function deleteSupply(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT quantity, product_article FROM supplies WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (current.rows.length === 0) throw createHttpError(404, 'Supply not found');
    const { quantity, product_article } = current.rows[0];
    await client.query('UPDATE products SET stock = GREATEST(stock - $1, 0) WHERE article = $2', [quantity, product_article]);
    await client.query('DELETE FROM supplies WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { listSupplies, getSupply, createSupply, updateSupply, deleteSupply };
