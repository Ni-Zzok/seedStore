const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const logger = require('../../services/logger.service');
const { requireAuth } = require('../../middleware/auth');

module.exports = (upload) => {
  const router = express.Router();

router.get('/profile', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT email, first_name, last_name, phone, address, birth_date, gender, newsletter, registration_date, avatar_url
            FROM Users
            WHERE id = $1
        `, [req.session.userId]);
        if (result.rows.length === 0) {
            return res.status(404).send('Пользователь не найден');
        }
        res.render('profile', { user: result.rows[0] });
    } catch (err) {
        logger.error('Ошибка при получении профиля: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/profile', requireAuth, async (req, res) => {
    const { email, firstName, lastName, phone, address, birthDate, gender, newsletter, newPassword, currentPassword } = req.body;
    const userId = req.session.userId;
    const saltRounds = 10;
    try {
        const userResult = await pool.query(`
            SELECT password
            FROM Users
            WHERE id = $1
        `, [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).send('Пользователь не найден');
        }
        const currentPasswordInDb = userResult.rows[0].password;
        const match = await bcrypt.compare(currentPassword, currentPasswordInDb);
        if (!match) {
            return res.status(400).send('Неверный текущий пароль');
        }

        const normalizeRequiredText = (value) => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        };

        const normalizeOptionalText = (value) => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        };

        const normalizeOptionalDate = (value) => {
            if (typeof value !== 'string') return null;
            const trimmed = value.trim();
            return trimmed.length > 0 ? trimmed : null;
        };

        const normalizedEmail = normalizeRequiredText(email);
        if (!normalizedEmail) {
            return res.status(400).send('Email не может быть пустым');
        }

        const normalizedFirstName = normalizeRequiredText(firstName);
        const normalizedLastName = normalizeOptionalText(lastName);
        const normalizedPhone = normalizeOptionalText(phone);
        const normalizedAddress = normalizeOptionalText(address);
        const normalizedBirthDate = normalizeOptionalDate(birthDate);
        const normalizedGender = normalizeOptionalText(gender);
        const normalizedNewPassword = normalizeOptionalText(newPassword);

        const updateFields = [];
        const values = [];
        let paramIndex = 1;
        updateFields.push(`email = $${paramIndex++}`);
        values.push(normalizedEmail);

        updateFields.push(`first_name = $${paramIndex++}`);
        values.push(normalizedFirstName);

        updateFields.push(`last_name = $${paramIndex++}`);
        values.push(normalizedLastName);

        updateFields.push(`phone = $${paramIndex++}`);
        values.push(normalizedPhone);

        updateFields.push(`address = $${paramIndex++}`);
        values.push(normalizedAddress);

        updateFields.push(`birth_date = $${paramIndex++}`);
        values.push(normalizedBirthDate);

        updateFields.push(`gender = $${paramIndex++}`);
        values.push(normalizedGender);

        updateFields.push(`newsletter = $${paramIndex++}`);
        values.push(newsletter === 'on');
        if (normalizedNewPassword) {
            const hashedNewPassword = await bcrypt.hash(normalizedNewPassword, saltRounds);
            updateFields.push(`password = $${paramIndex++}`);
            values.push(hashedNewPassword);
        }
        values.push(userId);
        if (updateFields.length > 0) {
            await pool.query(`
                UPDATE Users
                SET ${updateFields.join(', ')}
                WHERE id = $${paramIndex}
            `, values);
            const updatedUser = await pool.query(`
                SELECT email, first_name, last_name, avatar_url, role
                FROM Users
                WHERE id = $1
            `, [userId]);
            req.session.user = {
                email: updatedUser.rows[0].email,
                first_name: updatedUser.rows[0].first_name,
                last_name: updatedUser.rows[0].last_name,
                avatar_url: updatedUser.rows[0].avatar_url,
                role: updatedUser.rows[0].role
            };
            logger.info(`Профиль пользователя ${userId} обновлён`);
        }
        res.redirect('/profile');
        if (newPassword) {
            logger.info(`Пользователь ${userId} обновил пароль`);
        }
    } catch (err) {
        logger.error('Ошибка при обновлении профиля: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

// Маршруты оформления заказа
router.post('/profile/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
    const userId = req.session.userId;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не загружен' });
        }

        // Формируем URL для сохраненного файла
        const avatarUrl = `/avatars/${req.file.filename}`;

        // Обновляем avatar_url в базе данных
        await pool.query(`
            UPDATE Users
            SET avatar_url = $1
            WHERE id = $2
        `, [avatarUrl, userId]);

        // Обновляем данные в сессии
        req.session.user.avatar_url = avatarUrl;

        logger.info(`Аватар пользователя ${userId} обновлен: ${avatarUrl}`);
        res.status(200).json({ avatarUrl: avatarUrl });
    } catch (err) {
        logger.error('Ошибка при загрузке аватара: ' + err.stack);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

  return router;
};
