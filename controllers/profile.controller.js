const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');
const { publicUserFields, saveUserToSession } = require('./auth.controller');

async function getProfile(req, res) {
  const result = await pool.query(`SELECT ${publicUserFields} FROM users WHERE id = $1`, [req.session.userId]);
  if (result.rows.length === 0) throw createHttpError(404, 'User not found');
  res.json({ user: result.rows[0] });
}

async function updateProfile(req, res) {
  const allowed = { email: 'email', firstName: 'first_name', first_name: 'first_name', lastName: 'last_name', last_name: 'last_name', phone: 'phone', address: 'address', birthDate: 'birth_date', birth_date: 'birth_date', gender: 'gender', newsletter: 'newsletter' };
  const updates = [];
  const values = [];
  if (req.body.newPassword) {
    if (!req.body.currentPassword) throw createHttpError(400, 'currentPassword is required to change password');
    const current = await pool.query('SELECT password FROM users WHERE id = $1', [req.session.userId]);
    const match = await bcrypt.compare(req.body.currentPassword, current.rows[0]?.password || '');
    if (!match) throw createHttpError(400, 'Current password is invalid');
    values.push(await bcrypt.hash(req.body.newPassword, 10));
    updates.push(`password = $${values.length}`);
  }
  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(req.body, key)) {
      values.push(req.body[key]);
      updates.push(`${column} = $${values.length}`);
    }
  }
  if (updates.length === 0) throw createHttpError(400, 'No fields to update');
  values.push(req.session.userId);
  const result = await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING ${publicUserFields}`, values);
  saveUserToSession(req, result.rows[0]);
  res.json({ user: result.rows[0] });
}

async function uploadAvatar(req, res) {
  if (!req.file) throw createHttpError(400, 'File is required');
  const avatarUrl = `/avatars/${req.file.filename}`;
  const result = await pool.query(`UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING ${publicUserFields}`, [avatarUrl, req.session.userId]);
  saveUserToSession(req, result.rows[0]);
  res.json({ avatarUrl, user: result.rows[0] });
}

module.exports = { getProfile, updateProfile, uploadAvatar };
