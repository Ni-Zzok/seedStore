const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

const productSelect = `
  SELECT p.article, p.name, p.description, p.category_id, c.name AS category_name,
         p.image_url, p.price::float AS price, p.stock,
         COALESCE(ps.add_to_cart_count, 0)::int AS popularity
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  LEFT JOIN product_stats ps ON p.article = ps.product_article
`;

function normalizeProductBody(body) {
  return {
    article: body.article,
    name: body.name,
    description: body.description || null,
    image_url: body.image_url || body.imageUrl || null,
    price: body.price,
    stock: body.stock,
    category_id: body.category_id || body.categoryId || null
  };
}

function normalizeSearch(value) {
  if (!value) return '';
  let normalized = String(value).toLowerCase();
  const endings = ['ы', 'и', 'ов', 'ами', 'ам', 'ах', 'ей', 'ой', 'а', 'я'];
  for (const ending of endings) {
    if (normalized.endsWith(ending)) return normalized.slice(0, -ending.length);
  }
  return normalized;
}

async function assertCategoryExists(categoryId) {
  if (!categoryId) return;
  const result = await pool.query('SELECT id FROM categories WHERE id = $1', [categoryId]);
  if (result.rows.length === 0) throw createHttpError(400, 'Category not found');
}

async function listProducts(req, res) {
  const { search, category, inStock, sort = 'name_asc' } = req.query;
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || '24', 10), 1), 100);
  const offset = (page - 1) * limit;
  const values = [];
  const conditions = [];
  let cte = '';

  if (category) {
    values.push(category);
    cte = `WITH RECURSIVE category_tree AS (
      SELECT id FROM categories WHERE id = $1
      UNION ALL
      SELECT c.id FROM categories c JOIN category_tree ct ON c.parent_id = ct.id
    )`;
    conditions.push('p.category_id IN (SELECT id FROM category_tree)');
  }

  if (inStock === 'true') conditions.push('p.stock > 0');
  if (inStock === 'false') conditions.push('p.stock = 0');

  if (search) {
    const exact = String(search).toUpperCase();
    const normalized = normalizeSearch(search);
    values.push(exact);
    const exactIdx = values.length;
    values.push(normalized);
    const normalizedIdx = values.length;
    conditions.push(`(
      p.article = $${exactIdx}
      OR LOWER(p.name) LIKE '%' || LOWER($${normalizedIdx}) || '%'
      OR LOWER(p.description) LIKE '%' || LOWER($${normalizedIdx}) || '%'
      OR LOWER(p.article) LIKE '%' || LOWER($${normalizedIdx}) || '%'
    )`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sortMap = {
    name_asc: 'p.name ASC',
    name_desc: 'p.name DESC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    popularity_asc: 'COALESCE(ps.add_to_cart_count, 0) ASC',
    popularity_desc: 'COALESCE(ps.add_to_cart_count, 0) DESC'
  };
  const orderBy = sortMap[sort] || sortMap.name_asc;

  const countResult = await pool.query(`${cte} SELECT COUNT(*)::int AS total FROM products p LEFT JOIN product_stats ps ON p.article = ps.product_article ${where}`, values);
  const queryValues = [...values, limit, offset];
  const result = await pool.query(`${cte} ${productSelect} ${where} ORDER BY ${orderBy} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, queryValues);

  res.json({ items: result.rows, meta: { total: countResult.rows[0].total, page, limit } });
}

async function getProduct(req, res) {
  const result = await pool.query(`${productSelect} WHERE p.article = $1`, [req.params.article]);
  if (result.rows.length === 0) throw createHttpError(404, 'Product not found');
  res.json(result.rows[0]);
}

async function createProduct(req, res) {
  const product = normalizeProductBody(req.body);
  if (!product.article || !product.name || product.price === undefined || product.stock === undefined) {
    throw createHttpError(400, 'article, name, price and stock are required');
  }
  await assertCategoryExists(product.category_id);
  const result = await pool.query(`
    INSERT INTO products (article, name, description, category_id, image_url, price, stock)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING article
  `, [product.article, product.name, product.description, product.category_id, product.image_url, product.price, product.stock]);
  req.params.article = result.rows[0].article;
  return getProduct(req, res.status(201));
}

async function replaceProduct(req, res) {
  const product = normalizeProductBody(req.body);
  if (!product.name || product.price === undefined || product.stock === undefined) {
    throw createHttpError(400, 'name, price and stock are required');
  }
  await assertCategoryExists(product.category_id);
  const result = await pool.query(`
    UPDATE products SET name = $1, description = $2, category_id = $3, image_url = $4, price = $5, stock = $6
    WHERE article = $7 RETURNING article
  `, [product.name, product.description, product.category_id, product.image_url, product.price, product.stock, req.params.article]);
  if (result.rows.length === 0) throw createHttpError(404, 'Product not found');
  return getProduct(req, res);
}

async function updateProduct(req, res) {
  const allowed = { name: 'name', description: 'description', category_id: 'category_id', categoryId: 'category_id', image_url: 'image_url', imageUrl: 'image_url', price: 'price', stock: 'stock' };
  const updates = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      if (column === 'category_id') await assertCategoryExists(req.body[key]);
      values.push(req.body[key]);
      updates.push(`${column} = $${values.length}`);
    }
  }
  if (updates.length === 0) throw createHttpError(400, 'No fields to update');
  values.push(req.params.article);
  const result = await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE article = $${values.length} RETURNING article`, values);
  if (result.rows.length === 0) throw createHttpError(404, 'Product not found');
  return getProduct(req, res);
}

async function deleteProduct(req, res) {
  const result = await pool.query('DELETE FROM products WHERE article = $1', [req.params.article]);
  if (result.rowCount === 0) throw createHttpError(404, 'Product not found');
  res.status(204).send();
}

module.exports = { listProducts, getProduct, createProduct, replaceProduct, updateProduct, deleteProduct };
