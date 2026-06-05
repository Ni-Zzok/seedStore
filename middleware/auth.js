const pool = require('../db/pool');

function wantsJson(req) {
  return req.originalUrl.startsWith('/api/') || req.accepts(['json', 'html']) === 'json';
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.status(403).send('Необходимо войти в систему. <a href="/login">Войти</a>');
  }
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.session.userId) {
    if (wantsJson(req)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.status(403).send('Необходимо войти в систему. <a href="/login">Войти</a>');
  }

  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.session.userId]);
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      if (wantsJson(req)) {
        return res.status(403).json({ error: 'Admin role required' });
      }
      return res.status(403).send('Доступ запрещён. Требуются права администратора. <a href="/">На главную</a>');
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireAdmin };
