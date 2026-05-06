const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

async function listCategories(req, res) {
  const result = await pool.query('SELECT id, name, image_url, description, parent_id FROM categories ORDER BY name');
  res.json({ items: result.rows });
}

async function getCategory(req, res) {
  const result = await pool.query('SELECT id, name, image_url, description, parent_id FROM categories WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw createHttpError(404, 'Category not found');
  res.json(result.rows[0]);
}

async function createCategory(req, res) {
  const { name, image_url, imageUrl, description, parent_id, parentId } = req.body;
  if (!name) throw createHttpError(400, 'name is required');
  const result = await pool.query(`
    INSERT INTO categories (name, image_url, description, parent_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, name, image_url, description, parent_id
  `, [name, image_url || imageUrl || null, description || null, parent_id || parentId || null]);
  res.status(201).json(result.rows[0]);
}

async function updateCategory(req, res) {
  const allowed = { name: 'name', image_url: 'image_url', imageUrl: 'image_url', description: 'description', parent_id: 'parent_id', parentId: 'parent_id' };
  const updates = [];
  const values = [];
  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      values.push(req.body[key]);
      updates.push(`${column} = $${values.length}`);
    }
  }
  if (updates.length === 0) throw createHttpError(400, 'No fields to update');
  values.push(req.params.id);
  const result = await pool.query(`UPDATE categories SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, name, image_url, description, parent_id`, values);
  if (result.rows.length === 0) throw createHttpError(404, 'Category not found');
  res.json(result.rows[0]);
}

async function deleteCategory(req, res) {
  const result = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw createHttpError(404, 'Category not found');
  res.status(204).send();
}

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
