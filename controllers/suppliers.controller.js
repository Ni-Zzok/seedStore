const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

async function listSuppliers(req, res) {
  const result = await pool.query('SELECT id, name, contact_person, email, phone, address FROM suppliers ORDER BY name');
  res.json({ items: result.rows });
}

async function getSupplier(req, res) {
  const result = await pool.query('SELECT id, name, contact_person, email, phone, address FROM suppliers WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) throw createHttpError(404, 'Supplier not found');
  res.json(result.rows[0]);
}

async function createSupplier(req, res) {
  const { name, contact_person, contactPerson, email, phone, address } = req.body;
  if (!name) throw createHttpError(400, 'name is required');
  const result = await pool.query(`
    INSERT INTO suppliers (name, contact_person, email, phone, address)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, name, contact_person, email, phone, address
  `, [name, contact_person || contactPerson || null, email || null, phone || null, address || null]);
  res.status(201).json(result.rows[0]);
}

async function updateSupplier(req, res) {
  const allowed = { name: 'name', contact_person: 'contact_person', contactPerson: 'contact_person', email: 'email', phone: 'phone', address: 'address' };
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
  const result = await pool.query(`UPDATE suppliers SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING id, name, contact_person, email, phone, address`, values);
  if (result.rows.length === 0) throw createHttpError(404, 'Supplier not found');
  res.json(result.rows[0]);
}

async function deleteSupplier(req, res) {
  const result = await pool.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) throw createHttpError(404, 'Supplier not found');
  res.status(204).send();
}

module.exports = { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
