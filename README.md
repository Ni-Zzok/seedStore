# AgroShop / SeedStore

AgroShop — web-приложение интернет-магазина семян на Node.js, Express, EJS и PostgreSQL. В рамках ЛР №2 проект дополнен полноценным REST API, Swagger/OpenAPI документацией и клиентскими сценариями, которые обращаются к backend через `fetch`.

## Запуск

```bash
npm install
npm start
```

Для разработки можно использовать:

```bash
npm run dev
```

## Переменные окружения

Создайте локальный `.env` файл самостоятельно. Не коммитьте его в репозиторий.

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | Строка подключения к PostgreSQL. |
| `SESSION_SECRET` | Секрет для `express-session`. |
| `HTTPS_KEY_PATH` | Путь к приватному ключу HTTPS. Если не задан, приложение запускается по HTTP. |
| `HTTPS_CERT_PATH` | Путь к сертификату HTTPS. Если не задан, приложение запускается по HTTP. |
| `NODE_ENV` | `production` включает production-настройки SSL для PostgreSQL и HTTPS trust proxy. |

Для HTTPS нужно создать локальные сертификаты и указать пути в `HTTPS_KEY_PATH` и `HTTPS_CERT_PATH`.

## Адреса

- Web app: `/`
- API base: `/api`
- Swagger UI: `/api-docs`
- OpenAPI JSON: `/api-docs/openapi.json`

## Архитектура проекта

После рефакторинга `server.js` используется как entry point: создаёт Express-приложение, настраивает HTTP/HTTPS, сессии, middleware, Swagger, API routes, page routes, Socket.IO и запуск сервера. Основная логика вынесена из файла запуска:

- `db/pool.js` — общий PostgreSQL pool;
- `middleware/` — авторизация и единый JSON error handler для API;
- `controllers/` и `routes/api/` — REST API под `/api`;
- `routes/pages/` — старые HTML/EJS маршруты с сохранёнными URL;
- `services/` — общие сервисы логирования, дневной статистики и безопасно вынесенные повторяемые page SQL-запросы;
- `realtime/chat.socket.js` — логика Socket.IO чат-бота;
- `swagger/swagger.js` — OpenAPI спецификация и `/api-docs`.

## REST API

API использует текущие cookie-сессии `express-session`. Все endpoints под `/api/*` возвращают JSON. Ошибки возвращаются в едином формате:

```json
{
  "error": "Краткое описание ошибки",
  "details": "Дополнительные детали"
}
```

Основные ресурсы:

- `auth` — регистрация, вход, выход, текущий пользователь;
- `products` — товары, CRUD и фильтрация;
- `categories` — категории, CRUD;
- `suppliers` — поставщики, CRUD;
- `supplies` — поставки, CRUD и фильтрация;
- `cart` — корзина текущего пользователя;
- `orders` — заказы текущего пользователя;
- `profile` — профиль и аватар пользователя.

### Примеры запросов

Получить товары с фильтрацией:

```bash
curl "http://localhost:3000/api/products?search=томат&inStock=true&sort=price_asc&page=1&limit=10"
```

Получить один товар:

```bash
curl "http://localhost:3000/api/products/SEED-001"
```

Логин с сохранением cookie:

```bash
curl -c cookies.txt -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

Создать товар администратором:

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/products" \
  -H "Content-Type: application/json" \
  -d '{"article":"SEED-001","name":"Семена томата","description":"Ранний сорт","category_id":1,"image_url":"/images/tomatoes.jpg","price":120.00,"stock":15}'
```

Добавить товар в корзину:

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/cart/items" \
  -H "Content-Type: application/json" \
  -d '{"article":"SEED-001","quantity":2}'
```

Создать заказ из корзины:

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"shippingAddress":"г. Москва, ул. Полевая, д. 1"}'
```

## Клиентская часть

- Страница каталога `/catalog` загружает товары через `fetch('/api/products?...')`.
- Поиск, сортировка, фильтр по категории и наличию отправляются query-параметрами REST API.
- Добавление в корзину из каталога выполняется через `POST /api/cart/items`.
- Удаление из корзины на странице `/cart` выполняется через `DELETE /api/cart/items/:id`.
- Админская страница для товаров, категорий, поставщиков и поставок использует REST API для создания, обновления и удаления записей.

## Документация и тестирование

- Материал для отчёта: `docs/lab2-report.md`.
- Тест-кейсы и curl-примеры: `docs/api-test-cases.md`.
- Postman collection: `docs/postman_collection.json`.

## Примечания по БД

Проект использует существующую схему PostgreSQL: `users`, `categories`, `products`, `product_stats`, `cart`, `orders`, `order_items`, `suppliers`, `supplies`, `user_sessions`. Destructive migrations не добавлялись. При удалении сущностей, связанных с другими таблицами, API возвращает `409 Conflict`.
