const express = require('express');
const pool = require('../../db/pool');
const pageData = require('../../services/page-data.service');
const logger = require('../../services/logger.service');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.get('/cart', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(403).send('Необходимо войти в систему. <a href="/login">Войти</a>');
        }
        const cartItems = await pageData.getCartItems(req.session.userId);
        res.render('cart', { cartItems, user: req.session.user });
    } catch (err) {
        logger.error('Ошибка при получении корзины: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/cart/add', requireAuth, async (req, res) => {
    const { article, quantity } = req.body;
    const userId = req.session.userId;
    const quantityNum = parseInt(quantity);
    if (!article || isNaN(quantityNum) || quantityNum <= 0) {
        return res.status(400).send('Неверные данные');
    }
    try {
        const productResult = await pool.query(`
            SELECT stock
            FROM Products
            WHERE article = $1
        `, [article]);
        if (productResult.rows.length === 0) {
            return res.status(404).send('Товар не найден');
        }
        const stock = productResult.rows[0].stock;
        if (quantityNum > stock) {
            return res.status(400).send(`Недостаточно товара на складе. В наличии: ${stock} шт.`);
        }
        const cartResult = await pool.query(`
            SELECT id, quantity
            FROM Cart
            WHERE user_id = $1 AND product_article = $2
        `, [userId, article]);
        if (cartResult.rows.length > 0) {
            const newQuantity = cartResult.rows[0].quantity + quantityNum;
            if (newQuantity > stock) {
                return res.status(400).send(`Недостаточно товара на складе. В наличии: ${stock} шт.`);
            }
            await pool.query(`
                UPDATE Cart
                SET quantity = $1
                WHERE id = $2
            `, [newQuantity, cartResult.rows[0].id]);
        } else {
            await pool.query(`
                INSERT INTO Cart (user_id, product_article, quantity)
                VALUES ($1, $2, $3)
            `, [userId, article, quantityNum]);
        }
        await pool.query(`
            INSERT INTO product_stats (product_article, add_to_cart_count)
            VALUES ($1, 1)
            ON CONFLICT (product_article)
            DO UPDATE SET add_to_cart_count = product_stats.add_to_cart_count + 1
        `, [article]);
        logger.info(`Товар ${article} добавлен в корзину пользователя ${userId}, количество: ${quantityNum}`);
        res.redirect('/cart');
    } catch (err) {
        logger.error('Ошибка при добавлении товара в корзину: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.delete('/cart/remove/:id', requireAuth, async (req, res) => {
    const cartItemId = req.params.id;
    const userId = req.session.userId;
    try {
        const result = await pool.query(`
            DELETE FROM Cart
            WHERE id = $1 AND user_id = $2
        `, [cartItemId, userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Товар не найден в корзине' });
        }
        logger.info(`Товар с id ${cartItemId} удален из корзины пользователя ${userId}`);
        res.status(200).json({ message: 'Товар удален из корзины' });
    } catch (err) {
        logger.error('Ошибка при удалении товара из корзины: ' + err.stack);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});


module.exports = router;
