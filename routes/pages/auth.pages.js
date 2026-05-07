const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const logger = require('../../services/logger.service');

const router = express.Router();

router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/profile');
    }
    res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        logger.info(`Попытка входа: email=${email}`);
        const result = await pool.query(`
            SELECT id, email, password, first_name, last_name, avatar_url, role
            FROM Users
            WHERE email = $1
        `, [email]);
        if (result.rows.length === 0) {
            logger.warn(`Ошибка входа: email=${email}, reason=user_not_found`);
            return res.render('login', { error: 'Пользователь не найден', user: null });
        }
        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            logger.warn(`Ошибка входа: email=${email}, reason=wrong_password`);
            return res.render('login', { error: 'Неверный пароль', user: null });
        }
        req.session.userId = user.id;
        req.session.user = {
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            role: user.role
        };
        logger.info(`Успешный вход: email=${user.email}, userId=${user.id}`);
        if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            res.redirect('/');
        }
    } catch (err) {
        logger.error('Ошибка при входе: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/profile');
    }
    res.render('register', { error: null });
});

router.post('/register', async (req, res) => {
    const { email, password, firstName, lastName, phone, birthDate, newsletter } = req.body;
    const saltRounds = 10;
    try {
        const existingUser = await pool.query(`
            SELECT id
            FROM Users
            WHERE email = $1
        `, [email]);
        if (existingUser.rows.length > 0) {
            return res.render('register', { error: 'Пользователь с таким email уже существует', user: null });
        }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const result = await pool.query(`
            INSERT INTO Users (email, password, first_name, last_name, phone, birth_date, newsletter, role, registration_date)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'user', CURRENT_TIMESTAMP)
            RETURNING id, email, first_name, last_name
        `, [
            email,
            hashedPassword,
            firstName || null,
            lastName || null,
            phone || null,
            birthDate || null,
            newsletter === 'on' // Чекбокс отправляет 'on' или ничего
        ]);
        const user = result.rows[0];
        req.session.userId = user.id;
        req.session.user = {
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: null,
            role: 'user'
        };
        logger.info(`Новый пользователь зарегистрирован: ${user.email}`);
        res.redirect('/');
    } catch (err) {
        logger.error('Ошибка при регистрации: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.get('/logout', (req, res) => {
    const userEmail = req.session.user?.email || 'неизвестный пользователь';
    req.session.destroy((err) => {
        if (err) {
            logger.error('Ошибка при выходе: ' + err.stack);
            return res.status(500).send('Ошибка сервера');
        }
        logger.info(`Пользователь ${userEmail} вышел из системы`);
        res.redirect('/');
    });
});

module.exports = router;
