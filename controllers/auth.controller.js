const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { createHttpError } = require('../middleware/errorHandler');

const publicUserFields = 'id, email, role, first_name, last_name, phone, address, birth_date, gender, newsletter, registration_date, avatar_url';

function saveUserToSession(req, user) {
  req.session.userId = user.id;
  req.session.user = {
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar_url: user.avatar_url,
    role: user.role
  };
}

async function register(req, res) {
  const { email, password, firstName, lastName, phone, birthDate, newsletter } = req.body;
  if (!email || !password) throw createHttpError(400, 'email and password are required');
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) throw createHttpError(409, 'User with this email already exists');
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(`
    INSERT INTO users (email, password, first_name, last_name, phone, birth_date, newsletter, role, registration_date)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', CURRENT_TIMESTAMP)
    RETURNING ${publicUserFields}
  `, [email, hashedPassword, firstName || null, lastName || null, phone || null, birthDate || null, Boolean(newsletter)]);
  saveUserToSession(req, result.rows[0]);
  res.status(201).json({ user: result.rows[0] });
}

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) throw createHttpError(400, 'email and password are required');
  const result = await pool.query(`SELECT ${publicUserFields}, password FROM users WHERE email = $1`, [email]);
  if (result.rows.length === 0) throw createHttpError(401, 'Invalid email or password');
  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw createHttpError(401, 'Invalid email or password');
  delete user.password;
  saveUserToSession(req, user);
  res.json({ user });
}

async function logout(req, res) {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Internal Server Error' });
    res.json({ message: 'Logged out' });
  });
}

async function me(req, res) {
  if (!req.session.userId) throw createHttpError(401, 'Authentication required');
  const result = await pool.query(`SELECT ${publicUserFields} FROM users WHERE id = $1`, [req.session.userId]);
  if (result.rows.length === 0) throw createHttpError(401, 'Authentication required');
  res.json({ user: result.rows[0] });
}

module.exports = { register, login, logout, me, publicUserFields, saveUserToSession };
