const express = require('express');
const pool = require('../../db/pool');
const pageData = require('../../services/page-data.service');
const logger = require('../../services/logger.service');
const stats = require('../../services/stats.service');
const { requireAuth } = require('../../middleware/auth');

const router = express.Router();

router.get('/checkout', requireAuth, async (req, res) => {
    try {
        const cartItems = await pageData.getCartItems(req.session.userId);
        const address = await pageData.getUserAddress(req.session.userId);
        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }
        res.render('checkout', {
            cartItems,
            user: { ...req.session.user, address }
        });
    } catch (err) {
        logger.error('Ошибка при загрузке страницы оформления заказа: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/checkout', requireAuth, async (req, res) => {
    const { shippingAddress } = req.body;
    const userId = req.session.userId;
    try {
        logger.info(`Получение корзины для userId=${userId}`);
        const cartItems = await pageData.getCartItems(userId);
        if (cartItems.length === 0) {
            logger.info('Корзина пуста, редирект на /cart');
            return res.redirect('/cart');
        }
        logger.info(`Проверка наличия товаров: ${JSON.stringify(cartItems)}`);
        for (const item of cartItems) {
            if (item.quantity > item.stock) {
                logger.warn(`Недостаточно товара: ${item.name} (арт. ${item.article}), запрошено: ${item.quantity}, в наличии: ${item.stock}`);
                return res.status(400).send(`Товара "${item.name}" (арт. ${item.article}) недостаточно на складе. В наличии: ${item.stock} шт.`);
            }
        }
        const totalPrice = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        logger.info(`Создание заказа с totalPrice=${totalPrice}, shippingAddress=${shippingAddress}`);
        const orderResult = await pool.query(`
            INSERT INTO Orders (user_id, total_price, status, shipping_address, payment_method, created_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING id
        `, [userId, totalPrice, 'pending', shippingAddress, 'pending_payment']);
        const orderId = orderResult.rows[0].id;
        logger.info(`Заказ создан, orderId=${orderId}`);
        for (const item of cartItems) {
            logger.info(`Добавление элемента заказа: article=${item.article}, quantity=${item.quantity}`);
            await pool.query(`
                INSERT INTO Order_Items (order_id, quantity, price_at_time, product_article)
                VALUES ($1, $2, $3, $4)
            `, [orderId, item.quantity, item.price, item.article]);
            logger.info(`Обновление склада для article=${item.article}, уменьшение на ${item.quantity}`);
            await pool.query(`
                UPDATE Products
                SET stock = stock - $1
                WHERE article = $2
            `, [item.quantity, item.article]);
        }
        logger.info(`Очистка корзины для userId=${userId}`);
        await pool.query(`
            DELETE FROM Cart
            WHERE user_id = $1
        `, [userId]);
        logger.info(`Заказ #${orderId} создан для пользователя ${userId}`);
        res.redirect(`/payment/${orderId}`);
    } catch (err) {
        logger.error('Ошибка при подготовке заказа: ' + err.stack);
        res.status(500).render('error', { message: 'Ошибка сервера', user: req.session.user });
    }
});

// Маршруты оплаты
router.get('/payment/:orderId', requireAuth, async (req, res) => {
    const orderId = req.params.orderId;
    const userId = req.session.userId;
    try {
        // Ищем заказ в базе данных
        const orderResult = await pool.query(`
            SELECT o.id, o.total_price, o.shipping_address, o.created_at, o.status,
                   oi.quantity, oi.price_at_time, p.name, p.article, p.image_url
            FROM Orders o
            JOIN Order_Items oi ON o.id = oi.order_id
            JOIN Products p ON oi.product_article = p.article
            WHERE o.id = $1 AND o.user_id = $2 AND o.status = 'pending'
        `, [orderId, userId]);
        
        if (orderResult.rows.length === 0) {
            logger.warn(`Заказ #${orderId} не найден для пользователя ${userId} или уже обработан`);
            return res.status(404).send('Заказ не найден');
        }

        const order = {
            id: orderResult.rows[0].id,
            total_price: parseFloat(orderResult.rows[0].total_price),
            shipping_address: orderResult.rows[0].shipping_address,
            created_at: orderResult.rows[0].created_at,
            items: orderResult.rows.map(item => ({
                name: item.name,
                article: item.article,
                quantity: item.quantity,
                price_at_time: parseFloat(item.price_at_time),
                image_url: item.image_url
            }))
        };

        res.render('payment', { order, user: req.session.user });
    } catch (err) {
        logger.error('Ошибка при получении заказа для оплаты: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/payment/:orderId/process', requireAuth, async (req, res) => {
    const orderId = req.params.orderId;
    const userId = req.session.userId;
    try {
        // Проверяем, что заказ существует и принадлежит пользователю
        const orderResult = await pool.query(`
            SELECT total_price, status
            FROM Orders
            WHERE id = $1 AND user_id = $2
        `, [orderId, userId]);
        
        if (orderResult.rows.length === 0) {
            logger.warn(`Заказ #${orderId} не найден для пользователя ${userId}`);
            return res.status(404).send('Заказ не найден');
        }

        if (orderResult.rows[0].status !== 'pending') {
            logger.warn(`Заказ #${orderId} уже обработан, статус: ${orderResult.rows[0].status}`);
            return res.status(400).send('Заказ уже обработан');
        }

        // Обновляем статус заказа
        await pool.query(`
            UPDATE Orders
            SET status = $1, payment_method = $2
            WHERE id = $3
        `, ['completed', 'card', orderId]);

        // Получаем элементы заказа для статистики
        const itemsResult = await pool.query(`
            SELECT product_article, quantity
            FROM Order_Items
            WHERE order_id = $1
        `, [orderId]);

        // Обновляем статистику
        itemsResult.rows.forEach(item => {
            stats.trackProductOrder(item.product_article, item.quantity);
        });
        stats.statsLogger.info(stats.getDailyStats());

        logger.info(`Заказ #${orderId} оплачен и оформлен пользователем ${userId}`);
        res.redirect('/order-history');
    } catch (err) {
        logger.error('Ошибка при обработке оплаты: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

// Маршруты истории заказов
router.get('/order-history', requireAuth, async (req, res) => {
    try {
        const ordersResult = await pool.query(`
            SELECT id, total_price, status, shipping_address, payment_method, created_at
            FROM Orders
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [req.session.userId]);
        const orders = ordersResult.rows.map(order => {
            const totalPrice = parseFloat(order.total_price);
            return {
                ...order,
                total_price: isNaN(totalPrice) ? 0 : totalPrice
            };
        });
        for (let order of orders) {
            const itemsResult = await pool.query(`
                SELECT oi.quantity, oi.price_at_time, p.name, p.image_url
                FROM Order_Items oi
                JOIN Products p ON oi.product_article = p.article
                WHERE oi.order_id = $1
            `, [order.id]);
            order.items = itemsResult.rows.map(item => {
                const priceAtTime = parseFloat(item.price_at_time);
                return {
                    ...item,
                    price_at_time: isNaN(priceAtTime) ? 0 : priceAtTime
                };
            });
        }
        res.render('order-history', { orders, user: req.session.user });
    } catch (err) {
        logger.error('Ошибка при получении истории заказов: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;
