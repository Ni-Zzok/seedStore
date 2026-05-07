const pool = require('../db/pool');
const logger = require('../services/logger.service');

function setupChatSocket(io) {
  io.on('connection', (socket) => {
    const userId = socket.request.session?.userId || null;
    logger.info(`Пользователь подключился, userId: ${userId}`);
    const showMainMenu = (withGreeting = true) => {
        if (!userId) {
            if (withGreeting) {
                socket.emit('response', 'Привет! Я бот магазина семян. Ты можешь искать товары. Для других действий нужно войти в систему.');
            } else {
                socket.emit('response', 'Ты можешь искать товары или войти в систему для других действий:');
            }
            socket.emit('show_buttons', [
                { text: 'Поиск товаров', value: 'search' },
                { text: 'Оформить заказ', value: 'order' },
                { text: 'Показать историю заказов', value: 'history' }
            ]);
        } else {
            socket.emit('response', withGreeting ? 'Привет! Я бот магазина семян. Выбери действие:' : 'Выбери действие:');
            socket.emit('show_buttons', [
                { text: 'Поиск товаров', value: 'search' },
                { text: 'Оформить заказ', value: 'order' },
                { text: 'Показать историю заказов', value: 'history' }
            ]);
        }
    };
    showMainMenu(true);
    let orderState = {};
    socket.on('button_click', async (buttonValue) => {
        logger.info(`Получено событие button_click: ${buttonValue}`);
        if (buttonValue === 'search') {
            socket.emit('response', 'Введи название товара или артикул для поиска (например, "Огурец Сюрприз" или "13326"):');
            socket.emit('show_input', { placeholder: 'Название товара или артикул' });
        } else if (buttonValue === 'order') {
            if (!userId) {
                socket.emit('response', 'Для оформления заказа нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            orderState = { step: 'article' };
            socket.emit('response', 'Введи артикул товара для заказа (например, "12345"):');
            socket.emit('show_input', { placeholder: 'Артикул товара' });
        } else if (buttonValue === 'history') {
            if (!userId) {
                socket.emit('response', 'Для просмотра истории заказов нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            const ordersRes = await pool.query(
                `SELECT o.id, o.total_price, o.created_at, oi.quantity, oi.price_at_time, p.name, p.article 
                 FROM orders o 
                 JOIN order_items oi ON o.id = oi.order_id 
                 JOIN products p ON oi.product_article = p.article 
                 WHERE o.user_id = $1`,
                [userId]
            );
            if (ordersRes.rows.length > 0) {
                let responseText = '<b>Ваши заказы:</b><br>';
                ordersRes.rows.forEach(row => {
                    responseText += `
                        <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <b>Заказ #${row.id}</b><br>
                            Дата: ${new Date(row.created_at).toLocaleString('ru-RU')}<br>
                            Товар: ${row.name} (арт. ${row.article})<br>
                            Количество: ${row.quantity} шт.<br>
                            Цена за единицу: ${row.price_at_time} руб.<br>
                            Итого: ${row.total_price} руб.
                        </div>
                    `;
                });
                socket.emit('response', responseText);
            } else {
                socket.emit('response', 'У вас пока нет заказов.');
            }
            showMainMenu(false);
        } else if (buttonValue === 'use_previous_address' && orderState.step === 'address') {
            if (!userId) {
                socket.emit('response', 'Для оформления заказа нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            const userRes = await pool.query('SELECT address FROM users WHERE id = $1', [userId]);
            orderState.address = userRes.rows[0].address;
            const totalPrice = orderState.product.price * orderState.quantity;
            const orderRes = await pool.query(
                `INSERT INTO orders (user_id, total_price, status, shipping_address, payment_method, created_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [userId, totalPrice, 'pending', orderState.address, 'pending_payment']
            );
            const orderId = orderRes.rows[0].id;
            await pool.query(
                `INSERT INTO order_items (order_id, quantity, price_at_time, product_article) 
                 VALUES ($1, $2, $3, $4)`,
                [orderId, orderState.quantity, orderState.product.price, orderState.product.article]
            );
            await pool.query('UPDATE products SET stock = stock - $1 WHERE article = $2', [orderState.quantity, orderState.product.article]);
            const responseText = `
                <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <b>Заказ успешно оформлен!</b><br>
                    Заказ #${orderId}<br>
                    Товар: ${orderState.product.name} (арт. ${orderState.product.article})<br>
                    Количество: ${orderState.quantity} шт.<br>
                    Цена за единицу: ${orderState.product.price} руб.<br>
                    Итого: ${totalPrice} руб.<br>
                    Адрес доставки: ${orderState.address}<br>
                    <a href="/payment/${orderId}" style="color: #3c6f3c; text-decoration: underline;">Перейти к оплате</a>
                </div>
            `;
            socket.emit('response', responseText);
            logger.info(`Заказ #${orderId} оформлен пользователем ${userId}`);
            orderState = {};
            showMainMenu(false);
        } else if (buttonValue === 'new_address' && orderState.step === 'address') {
            socket.emit('response', 'Укажи новый адрес доставки:');
            socket.emit('show_input', { placeholder: 'Адрес доставки' });
        }
    });
    socket.on('input_submit', async (msg) => {
        logger.info(`Получено событие input_submit: userId=${userId || 'guest'}, messageLength=${msg ? msg.length : 0}`);
        if (orderState.step === 'article') {
            if (!userId) {
                socket.emit('response', 'Для оформления заказа нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            const article = msg.trim().toUpperCase();
            if (!article.match(/^\d{5}$/)) {
                socket.emit('response', 'Укажи корректный артикул, например, "12345".');
                socket.emit('show_input', { placeholder: 'Артикул товара' });
                return;
            }
            const productRes = await pool.query('SELECT * FROM products WHERE article = $1', [article]);
            if (productRes.rows.length === 0 || productRes.rows[0].stock <= 0) {
                socket.emit('response', 'Товар не найден или отсутствует на складе.');
            } else {
                orderState.product = productRes.rows[0];
                orderState.step = 'quantity';
                socket.emit('response', `Вы выбрали: <b>${orderState.product.name}</b> (арт. ${article}). В наличии: ${orderState.product.stock} шт.<br>Укажи количество:`);
                socket.emit('show_input', { placeholder: 'Количество' });
                return;
            }
        } else if (orderState.step === 'quantity') {
            if (!userId) {
                socket.emit('response', 'Для оформления заказа нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            const quantity = parseInt(msg.trim());
            if (isNaN(quantity) || quantity <= 0 || quantity > orderState.product.stock) {
                socket.emit('response', `Укажи корректное количество (от 1 до ${orderState.product.stock}):`);
                socket.emit('show_input', { placeholder: 'Количество' });
                return;
            }
            orderState.quantity = quantity;
            const userRes = await pool.query('SELECT address FROM users WHERE id = $1', [userId]);
            const previousAddress = userRes.rows[0]?.address || null;
            orderState.step = 'address';
            if (previousAddress) {
                socket.emit('response', `Предыдущий адрес доставки: <b>${previousAddress}</b><br>Использовать этот адрес?`);
                socket.emit('show_buttons', [
                    { text: 'Да, использовать', value: 'use_previous_address' },
                    { text: 'Нет, ввести новый', value: 'new_address' }
                ]);
            } else {
                socket.emit('response', 'Укажи адрес доставки:');
                socket.emit('show_input', { placeholder: 'Адрес доставки' });
            }
            return;
        } else if (orderState.step === 'address') {
            if (!userId) {
                socket.emit('response', 'Для оформления заказа нужно войти в систему. <a href="/login">Войти</a>');
                showMainMenu(false);
                return;
            }
            orderState.address = msg.trim();
            if (!orderState.address) {
                socket.emit('response', 'Адрес не может быть пустым. Укажи адрес доставки:');
                socket.emit('show_input', { placeholder: 'Адрес доставки' });
                return;
            }
            const totalPrice = orderState.product.price * orderState.quantity;
            const orderRes = await pool.query(
                `INSERT INTO orders (user_id, total_price, status, shipping_address, payment_method, created_at) 
                 VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
                [userId, totalPrice, 'pending', orderState.address, 'pending_payment']
            );
            const orderId = orderRes.rows[0].id;
            await pool.query(
                `INSERT INTO order_items (order_id, quantity, price_at_time, product_article) 
                 VALUES ($1, $2, $3, $4)`,
                [orderId, orderState.quantity, orderState.product.price, orderState.product.article]
            );
            await pool.query('UPDATE products SET stock = stock - $1 WHERE article = $2', [orderState.quantity, orderState.product.article]);
            await pool.query('UPDATE users SET address = $1 WHERE id = $2', [orderState.address, userId]);
            const responseText = `
                <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <b>Заказ успешно оформлен!</b><br>
                    Заказ #${orderId}<br>
                    Товар: ${orderState.product.name} (арт. ${orderState.product.article})<br>
                    Количество: ${orderState.quantity} шт.<br>
                    Цена за единицу: ${orderState.product.price} руб.<br>
                    Итого: ${totalPrice} руб.<br>
                    Адрес доставки: ${orderState.address}<br>
                    <a href="/payment/${orderId}" style="color: #3c6f3c; text-decoration: underline;">Перейти к оплате</a>
                </div>
            `;
            socket.emit('response', responseText);
            logger.info(`Заказ #${orderId} оформлен пользователем ${userId}`);
            orderState = {};
            showMainMenu(false);
        } else {
            const searchQuery = msg.trim().toLowerCase();
            if (!searchQuery) {
                socket.emit('response', 'Укажи, что именно ты хочешь найти. Например: "Огурец Сюрприз" или "13326".');
                socket.emit('show_input', { placeholder: 'Название товара или артикул' });
                return;
            }
            const exactMatch = await pool.query(`
                SELECT p.*, c.name as category_name 
                FROM products p 
                LEFT JOIN categories c ON p.category_id = c.id 
                WHERE p.article = $1
            `, [searchQuery]);
            if (exactMatch.rows.length > 0) {
                let responseText = '<b>Найденные товары:</b><br>';
                exactMatch.rows.forEach(row => {
                    responseText += `
                        <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                            <b>${row.name}</b><br>
                            Артикул: ${row.article}<br>
                            Категория: ${row.category_name || 'нет'}<br>
                            Цена: ${row.price} руб.<br>
                            В наличии: ${row.stock} шт.
                        </div>
                    `;
                });
                socket.emit('response', responseText);
            } else {
                let normalizedQuery = searchQuery;
                const endings = ['ы', 'и', 'ов', 'ами', 'ам', 'ах', 'ей', 'ой', 'а', 'я'];
                for (const ending of endings) {
                    if (normalizedQuery.endsWith(ending)) {
                        normalizedQuery = normalizedQuery.slice(0, -ending.length);
                        break;
                    }
                }
                const fullMatchRes = await pool.query(`
                    SELECT p.*, c.name as category_name, SIMILARITY(p.name, $1) as similarity_score
                    FROM products p 
                    LEFT JOIN categories c ON p.category_id = c.id 
                    WHERE SIMILARITY(LOWER(p.name), LOWER($1)) > 0.2 OR SIMILARITY(LOWER(p.name), LOWER($2)) > 0.2
                    ORDER BY SIMILARITY(LOWER(p.name), LOWER($1)) DESC
                    LIMIT 5
                `, [searchQuery, normalizedQuery]);
                const wordMatchRes = await pool.query(`
                    WITH words AS (
                        SELECT p.*, c.name as category_name, unnest(string_to_array(LOWER(p.name), ' ')) as word
                        FROM products p
                        LEFT JOIN categories c ON p.category_id = c.id
                    )
                    SELECT DISTINCT p.*, p.category_name, 
                        SIMILARITY(p.word, $1) as similarity_score
                    FROM words p
                    WHERE SIMILARITY(p.word, $1) > 0.2 
                        OR SIMILARITY(p.word, $2) > 0.2
                        OR p.word ILIKE '%' || $1 || '%'
                        OR p.word ILIKE '%' || $2 || '%'
                    ORDER BY similarity_score DESC
                    LIMIT 5
                `, [searchQuery, normalizedQuery]);
                const combinedResults = [...fullMatchRes.rows, ...wordMatchRes.rows];
                const uniqueResults = Array.from(new Map(combinedResults.map(item => [item.article, item])).values())
                    .sort((a, b) => {
                        const scoreA = a.similarity_score || 0;
                        const scoreB = b.similarity_score || 0;
                        return scoreB - scoreA;
                    });
                if (uniqueResults.length > 0) {
                    let responseText = '<b>Возможно, вы имели в виду:</b><br>';
                    uniqueResults.forEach(row => {
                        logger.info(`Найден товар: ${row.name} (арт. ${row.article}), схожесть: ${(row.similarity_score * 100).toFixed(1)}%`);
                        responseText += `
                            <div style="margin-bottom: 10px; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                                <b>${row.name}</b><br>
                                Артикул: ${row.article}<br>
                                Категория: ${row.category_name || 'нет'}<br>
                                Цена: ${row.price} руб.<br>
                                В наличии: ${row.stock} шт.
                            </div>
                        `;
                    });
                    socket.emit('response', responseText);
                } else {
                    socket.emit('response', 'Ничего не найдено. Попробуй уточнить запрос.');
                }
            }
            showMainMenu(false);
        }
    });
    socket.on('cancel_action', () => {
        logger.info('Получено событие cancel_action');
        orderState = {};
        socket.emit('response', 'Действие отменено.');
        showMainMenu(false);
    });
});

// Маршруты админ-панели
}

module.exports = setupChatSocket;
