const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const logger = require('../../services/logger.service');
const stats = require('../../services/stats.service');
const { requireAdmin } = require('../../middleware/auth');

const router = express.Router();

router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const users = (await pool.query('SELECT * FROM Users')).rows;
        const products = (await pool.query('SELECT * FROM Products')).rows;
        const categories = (await pool.query('SELECT * FROM Categories')).rows;
        const orders = (await pool.query('SELECT * FROM Orders')).rows;
        const order_items = (await pool.query('SELECT * FROM Order_Items')).rows;
        const cart = (await pool.query('SELECT * FROM Cart')).rows;
        const product_stats = (await pool.query('SELECT * FROM Product_Stats')).rows;
        const suppliers = (await pool.query('SELECT * FROM Suppliers')).rows;
        const supplies = (await pool.query('SELECT * FROM Supplies')).rows;
        res.render('admin', {
            user: req.session.user,
            users,
            products,
            categories,
            orders,
            order_items,
            cart,
            product_stats,
            suppliers,
            supplies
        });
    } catch (err) {
        logger.error('Ошибка при загрузке админской страницы: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/admin/:table/add', requireAdmin, async (req, res) => {
    const table = req.params.table;
    const data = req.body;
    const saltRounds = 10;
    try {
        if (table === 'users') {
            const { email, password, role, first_name, last_name, phone, address, birth_date, gender, newsletter } = data;
            const hashedPassword = await bcrypt.hash(password, saltRounds);
            await pool.query(`
                INSERT INTO Users (email, password, role, first_name, last_name, phone, address, birth_date, gender, newsletter, registration_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            `, [email, hashedPassword, role, first_name, last_name, phone, address, birth_date, gender, newsletter === 'on']);
        } else if (table === 'products') {
            const { article, name, description, category_id, image_url, price, stock } = data;
            await pool.query(`
                INSERT INTO Products (article, name, description, category_id, image_url, price, stock)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [article, name, description, category_id, image_url, price, stock]);
        } else if (table === 'categories') {
            const { name, image_url, description, parent_id } = data;
            await pool.query(`
                INSERT INTO Categories (name, image_url, description, parent_id)
                VALUES ($1, $2, $3, $4)
            `, [name, image_url, description, parent_id]);
        } else if (table === 'orders') {
            const { user_id, total_price, status, shipping_address, payment_method } = data;
            await pool.query(`
                INSERT INTO Orders (user_id, total_price, status, shipping_address, payment_method, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [user_id, total_price, status, shipping_address, payment_method]);
        } else if (table === 'order_items') {
            const { order_id, quantity, price_at_time, product_article } = data;
            await pool.query(`
                INSERT INTO Order_Items (order_id, quantity, price_at_time, product_article)
                VALUES ($1, $2, $3, $4)
            `, [order_id, quantity, price_at_time, product_article]);
        } else if (table === 'cart') {
            const { user_id, quantity, product_article } = data;
            await pool.query(`
                INSERT INTO Cart (user_id, quantity, product_article)
                VALUES ($1, $2, $3)
            `, [user_id, quantity, product_article]);
        } else if (table === 'product_stats') {
            const { product_article, add_to_cart_count } = data;
            await pool.query(`
                INSERT INTO Product_Stats (product_article, add_to_cart_count)
                VALUES ($1, $2)
            `, [product_article, add_to_cart_count]);
        } else if (table === 'suppliers') {
            const { name, contact_person, email, phone, address } = data;
            await pool.query(`
                INSERT INTO Suppliers (name, contact_person, email, phone, address)
                VALUES ($1, $2, $3, $4, $5)
            `, [name, contact_person, email, phone, address]);
        } else if (table === 'supplies') {
            const { supplier_id, quantity, supply_date, price_per_unit, product_article } = data;
            await pool.query(`
                INSERT INTO Supplies (supplier_id, quantity, supply_date, price_per_unit, product_article, created_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
            `, [supplier_id, quantity, supply_date, price_per_unit, product_article]);
        }
        res.redirect('/admin');
    } catch (err) {
        logger.error(`Ошибка при добавлении записи в ${table}: ` + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/admin/:table/edit', requireAdmin, async (req, res) => {
    const table = req.params.table;
    const data = req.body;
    const saltRounds = 10;
    try {
        if (table === 'users') {
            const { id, email, password, role, first_name, last_name, phone, address, birth_date, gender, newsletter } = data;
            const hashedPassword = password ? await bcrypt.hash(password, saltRounds) : (await pool.query('SELECT password FROM Users WHERE id = $1', [id])).rows[0].password;
            await pool.query(`
                UPDATE Users
                SET email = $1, password = $2, role = $3, first_name = $4, last_name = $5, phone = $6, address = $7, birth_date = $8, gender = $9, newsletter = $10
                WHERE id = $11
            `, [email, hashedPassword, role, first_name, last_name, phone, address, birth_date, gender, newsletter === 'on', id]);
        } else if (table === 'products') {
            const { article, name, description, category_id, image_url, price, stock } = data;
            await pool.query(`
                UPDATE Products
                SET name = $1, description = $2, category_id = $3, image_url = $4, price = $5, stock = $6
                WHERE article = $7
            `, [name, description, category_id, image_url, price, stock, article]);
        } else if (table === 'categories') {
            const { id, name, image_url, description, parent_id } = data;
            await pool.query(`
                UPDATE Categories
                SET name = $1, image_url = $2, description = $3, parent_id = $4
                WHERE id = $5
            `, [name, image_url, description, parent_id, id]);
        } else if (table === 'orders') {
            const { id, user_id, total_price, status, shipping_address, payment_method } = data;
            await pool.query(`
                UPDATE Orders
                SET user_id = $1, total_price = $2, status = $3, shipping_address = $4, payment_method = $5
                WHERE id = $6
            `, [user_id, total_price, status, shipping_address, payment_method, id]);
        } else if (table === 'order_items') {
            const { id, order_id, quantity, price_at_time, product_article } = data;
            await pool.query(`
                UPDATE Order_Items
                SET order_id = $1, quantity = $2, price_at_time = $3, product_article = $4
                WHERE id = $5
            `, [order_id, quantity, price_at_time, product_article, id]);
        } else if (table === 'cart') {
            const { id, user_id, quantity, product_article } = data;
            await pool.query(`
                UPDATE Cart
                SET user_id = $1, quantity = $2, product_article = $3
                WHERE id = $4
            `, [user_id, quantity, product_article, id]);
        } else if (table === 'product_stats') {
            const { product_article, add_to_cart_count } = data;
            await pool.query(`
                UPDATE Product_Stats
                SET add_to_cart_count = $1
                WHERE product_article = $2
            `, [add_to_cart_count, product_article]);
        } else if (table === 'suppliers') {
            const { id, name, contact_person, email, phone, address } = data;
            await pool.query(`
                UPDATE Suppliers
                SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5
                WHERE id = $6
            `, [name, contact_person, email, phone, address, id]);
        } else if (table === 'supplies') {
            const { id, supplier_id, quantity, supply_date, price_per_unit, product_article } = data;
            await pool.query(`
                UPDATE Supplies
                SET supplier_id = $1, quantity = $2, supply_date = $3, price_per_unit = $4, product_article = $5
                WHERE id = $6
            `, [supplier_id, quantity, supply_date, price_per_unit, product_article, id]);
        }
        res.redirect('/admin');
    } catch (err) {
        logger.error(`Ошибка при редактировании записи в ${table}: ` + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/admin/:table/delete', requireAdmin, async (req, res) => {
    const table = req.params.table;
    const rawId = req.body ? req.body.id : undefined;
    const id = typeof rawId === 'string' ? rawId.trim() : rawId;

    if (id === undefined || id === null || id === '') {
        return res.status(400).send('Не передан id для удаления');
    }

    try {
        if (table === 'users') {
            await pool.query('DELETE FROM Users WHERE id = $1', [id]);
        } else if (table === 'products') {
            await pool.query('DELETE FROM Products WHERE article = $1', [id]);
        } else if (table === 'categories') {
            await pool.query('DELETE FROM Categories WHERE id = $1', [id]);
        } else if (table === 'orders') {
            await pool.query('DELETE FROM Orders WHERE id = $1', [id]);
        } else if (table === 'order_items') {
            await pool.query('DELETE FROM Order_Items WHERE id = $1', [id]);
        } else if (table === 'cart') {
            await pool.query('DELETE FROM Cart WHERE id = $1', [id]);
        } else if (table === 'product_stats') {
            await pool.query('DELETE FROM Product_Stats WHERE product_article = $1', [id]);
        } else if (table === 'suppliers') {
            await pool.query('DELETE FROM Suppliers WHERE id = $1', [id]);
        } else if (table === 'supplies') {
            await pool.query('DELETE FROM Supplies WHERE id = $1', [id]);
        }
        res.status(200).send('Запись удалена');
    } catch (err) {
        logger.error(`Ошибка при удалении записи из ${table}: ` + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

// Маршрут статистики продаж
// Маршрут статистики продаж
router.get('/admin/sales-stats', requireAdmin, async (req, res) => {
    try {
        const totalRevenue = await pool.query(`
            SELECT COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
        `);
        const totalRevenueValue = parseFloat(totalRevenue.rows[0].total);
        const todayRevenue = await pool.query(`
            SELECT COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
            AND DATE(created_at) = CURRENT_DATE
        `);
        const todayRevenueValue = parseFloat(todayRevenue.rows[0].total);
        const weekRevenue = await pool.query(`
            SELECT COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '7 days'
        `);
        const weekRevenueValue = parseFloat(weekRevenue.rows[0].total);
        const monthRevenue = await pool.query(`
            SELECT COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
        `);
        const monthRevenueValue = parseFloat(monthRevenue.rows[0].total);
        const topProducts = await pool.query(`
            SELECT p.article, p.name, SUM(oi.quantity) AS total_sold
            FROM Order_Items oi
            JOIN Products p ON oi.product_article = p.article
            JOIN Orders o ON oi.order_id = o.id
            WHERE o.status = 'completed'
            GROUP BY p.article, p.name
            ORDER BY total_sold DESC
            LIMIT 5
        `);
        const orderStats = await pool.query(`
            SELECT status, COUNT(*) AS count
            FROM Orders
            GROUP BY status
        `);
        const salesByDay = await pool.query(`
            SELECT DATE(created_at) AS sale_date, COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(created_at)
            ORDER BY sale_date
        `);
        const salesByMonth = await pool.query(`
            SELECT DATE_TRUNC('month', created_at) AS sale_month, COALESCE(SUM(total_price), 0) AS total
            FROM Orders
            WHERE status = 'completed'
            AND created_at >= CURRENT_DATE - INTERVAL '1 year'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY sale_month
        `);

        // Подготовка данных о продажах по товарам за день
        const dailyProductSales = [];
        for (const [article, quantity] of Object.entries(stats.getDailyStats().productOrders)) {
            const productResult = await pool.query(`
                SELECT article, name
                FROM Products
                WHERE article = $1
            `, [article]);
            if (productResult.rows.length > 0) {
                dailyProductSales.push({
                    article: productResult.rows[0].article,
                    name: productResult.rows[0].name,
                    quantity: quantity
                });
            }
        }
        // Сортируем по количеству продаж (по убыванию)
        dailyProductSales.sort((a, b) => b.quantity - a.quantity);

        res.render('sales-stats', {
            user: req.session.user,
            totalRevenue: totalRevenueValue,
            todayRevenue: todayRevenueValue,
            weekRevenue: weekRevenueValue,
            monthRevenue: monthRevenueValue,
            topProducts: topProducts.rows,
            orderStats: orderStats.rows,
            salesByDay: salesByDay.rows,
            salesByMonth: salesByMonth.rows,
            dailyVisits: stats.getDailyStats().visits,
            dailyProductSales: dailyProductSales // Добавляем статистику продаж по товарам
        });
    } catch (err) {
        logger.error('Ошибка при загрузке страницы статистики продаж: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

// Запуск сервера

module.exports = router;
