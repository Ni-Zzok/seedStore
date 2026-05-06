# Тестирование REST API AgroShop

Базовый URL для локального запуска: `http://localhost:3000/api`.

Для защищённых запросов сначала выполните логин и сохраните cookie:

```bash
curl -c cookies.txt -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

> Данные `admin@example.com/password` являются примером. Используйте локальную тестовую учётную запись из своей БД.

## 1. Регистрация пользователя

```bash
curl -c cookies.txt -X POST "http://localhost:3000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password","firstName":"Иван","lastName":"Петров","phone":"+79990000000","birthDate":"2000-01-01","newsletter":true}'
```

Ожидаемый результат: `201 Created`, JSON с объектом `user` без поля `password`.

## 2. Логин

```bash
curl -c cookies.txt -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

Ожидаемый результат: `200 OK`, JSON с текущим пользователем.

## 3. Получение текущего пользователя

```bash
curl -b cookies.txt "http://localhost:3000/api/auth/me"
```

Ожидаемый результат: `200 OK`; без cookie — `401 Unauthorized`.

## 4. Получение списка товаров

```bash
curl "http://localhost:3000/api/products?page=1&limit=10"
```

Ожидаемый результат: JSON `{ "items": [...], "meta": { "total": ..., "page": 1, "limit": 10 } }`.

## 5. Фильтрация товаров

```bash
curl "http://localhost:3000/api/products?search=томат&category=1&inStock=true&sort=price_asc&page=1&limit=10"
```

Проверяется поиск по названию, описанию и артикулу, фильтр по категории, фильтр наличия и сортировка.

## 6. Получение товара по article

```bash
curl "http://localhost:3000/api/products/SEED-001"
```

Ожидаемый результат: `200 OK` или `404 Not Found`.

## 7. Создание товара администратором

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/products" \
  -H "Content-Type: application/json" \
  -d '{"article":"SEED-TEST","name":"Семена тестовые","description":"Товар для теста","category_id":1,"image_url":"/images/tomatoes.jpg","price":99.90,"stock":10}'
```

Ожидаемый результат: `201 Created`. Для пользователя без роли `admin` — `403 Forbidden`.

## 8. Обновление товара

```bash
curl -b cookies.txt -X PATCH "http://localhost:3000/api/products/SEED-TEST" \
  -H "Content-Type: application/json" \
  -d '{"price":109.90,"stock":12}'
```

Ожидаемый результат: `200 OK`, обновлённый товар.

## 9. Удаление товара

```bash
curl -b cookies.txt -X DELETE "http://localhost:3000/api/products/SEED-TEST"
```

Ожидаемый результат: `204 No Content`; если товар используется связанными записями — `409 Conflict`.

## 10. Добавление товара в корзину

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/cart/items" \
  -H "Content-Type: application/json" \
  -d '{"article":"SEED-001","quantity":2}'
```

Ожидаемый результат: `201 Created`, JSON элемента корзины.

## 11. Получение корзины

```bash
curl -b cookies.txt "http://localhost:3000/api/cart"
```

Ожидаемый результат: список товаров корзины и итоговая сумма.

## 12. Изменение количества

```bash
curl -b cookies.txt -X PATCH "http://localhost:3000/api/cart/items/1" \
  -H "Content-Type: application/json" \
  -d '{"quantity":3}'
```

Ожидаемый результат: `200 OK`, обновлённый элемент корзины.

## 13. Удаление из корзины

```bash
curl -b cookies.txt -X DELETE "http://localhost:3000/api/cart/items/1"
```

Ожидаемый результат: `204 No Content`.

## 14. Создание заказа

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/orders" \
  -H "Content-Type: application/json" \
  -d '{"shippingAddress":"г. Москва, ул. Полевая, д. 1"}'
```

Ожидаемый результат: `201 Created`. API проверяет остатки, создаёт `orders` и `order_items`, уменьшает `products.stock` и очищает `cart` в транзакции.

## 15. Получение заказов

```bash
curl -b cookies.txt "http://localhost:3000/api/orders"
```

Ожидаемый результат: список заказов текущего пользователя.

## Дополнительные проверки suppliers/supplies

```bash
curl -b cookies.txt -X POST "http://localhost:3000/api/suppliers" \
  -H "Content-Type: application/json" \
  -d '{"name":"Тестовый поставщик","contact_person":"Иван Иванов","email":"supplier@example.com","phone":"+79990000000","address":"Склад 1"}'
```

```bash
curl -b cookies.txt "http://localhost:3000/api/supplies?supplierId=1&productArticle=SEED-001&dateFrom=2026-01-01&dateTo=2026-12-31"
```
