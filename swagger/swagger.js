const openApiSpec = {
  openapi: '3.0.0',
  info: { title: 'AgroShop REST API', version: '1.0.0', description: 'REST API для интернет-магазина семян.' },
  servers: [{ url: '/api', description: 'API base URL' }],
  components: {
    securitySchemes: { sessionCookie: { type: 'apiKey', in: 'cookie', name: 'connect.sid' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' }, details: { type: 'string' } } },
      User: { type: 'object', properties: { id: { type: 'integer' }, email: { type: 'string' }, role: { type: 'string' }, first_name: { type: 'string' }, last_name: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' }, birth_date: { type: 'string', format: 'date' }, gender: { type: 'string' }, newsletter: { type: 'boolean' }, registration_date: { type: 'string', format: 'date-time' }, avatar_url: { type: 'string' } } },
      Product: { type: 'object', properties: { article: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, category_id: { type: 'integer' }, category_name: { type: 'string' }, image_url: { type: 'string' }, price: { type: 'number', format: 'float' }, stock: { type: 'integer' }, popularity: { type: 'integer' } } },
      Category: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, image_url: { type: 'string' }, description: { type: 'string' }, parent_id: { type: 'integer', nullable: true } } },
      Supplier: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, contact_person: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, address: { type: 'string' } } },
      Supply: { type: 'object', properties: { id: { type: 'integer' }, supplier_id: { type: 'integer' }, supplier_name: { type: 'string' }, product_article: { type: 'string' }, product_name: { type: 'string' }, quantity: { type: 'integer' }, supply_date: { type: 'string', format: 'date' }, price_per_unit: { type: 'number' }, total_cost: { type: 'number' }, created_at: { type: 'string', format: 'date-time' } } },
      CartItem: { type: 'object', properties: { id: { type: 'integer' }, quantity: { type: 'integer' }, product_article: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, image_url: { type: 'string' } } },
      Order: { type: 'object', properties: { id: { type: 'integer' }, user_id: { type: 'integer' }, total_price: { type: 'number' }, status: { type: 'string' }, shipping_address: { type: 'string' }, payment_method: { type: 'string' }, created_at: { type: 'string', format: 'date-time' }, items: { type: 'array', items: { type: 'object' } } } }
    }
  },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], summary: 'Регистрация', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' }, firstName: { type: 'string' }, lastName: { type: 'string' }, phone: { type: 'string' }, birthDate: { type: 'string', format: 'date' }, newsletter: { type: 'boolean' } } } } } }, responses: { 201: { description: 'Created' }, 409: { description: 'Conflict' } } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Вход', requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Выход', responses: { 200: { description: 'OK' } } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Текущий пользователь', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' }, 401: { description: 'Unauthorized' } } } },
    '/products': { get: { tags: ['Products'], summary: 'Список товаров с фильтрами', parameters: ['search','category','inStock','sort','page','limit'].map(name => ({ name, in: 'query', schema: { type: 'string' } })), responses: { 200: { description: 'OK' } } }, post: { tags: ['Products'], summary: 'Создать товар', security: [{ sessionCookie: [] }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Product' } } } }, responses: { 201: { description: 'Created' } } } },
    '/products/{article}': { get: { tags: ['Products'], summary: 'Один товар', parameters: [{ name: 'article', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' }, 404: { description: 'Not Found' } } }, put: { tags: ['Products'], summary: 'Полное обновление товара', security: [{ sessionCookie: [] }], parameters: [{ name: 'article', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } }, patch: { tags: ['Products'], summary: 'Частичное обновление товара', security: [{ sessionCookie: [] }], parameters: [{ name: 'article', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'OK' } } }, delete: { tags: ['Products'], summary: 'Удалить товар', security: [{ sessionCookie: [] }], parameters: [{ name: 'article', in: 'path', required: true, schema: { type: 'string' } }], responses: { 204: { description: 'No Content' }, 409: { description: 'Conflict' } } } },
    '/categories': crudPath('Categories', 'Category'),
    '/categories/{id}': crudIdPath('Categories'),
    '/suppliers': crudPath('Suppliers', 'Supplier'),
    '/suppliers/{id}': crudIdPath('Suppliers'),
    '/supplies': crudPath('Supplies', 'Supply', [{ name: 'supplierId', in: 'query', schema: { type: 'integer' } }, { name: 'productArticle', in: 'query', schema: { type: 'string' } }, { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date' } }, { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date' } }]),
    '/supplies/{id}': crudIdPath('Supplies'),
    '/cart': { get: { tags: ['Cart'], summary: 'Корзина', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' } } } },
    '/cart/items': { post: { tags: ['Cart'], summary: 'Добавить товар в корзину', security: [{ sessionCookie: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { article: { type: 'string' }, quantity: { type: 'integer' } } } } } }, responses: { 201: { description: 'Created' } } } },
    '/cart/items/{id}': { patch: { tags: ['Cart'], summary: 'Изменить количество', security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 200: { description: 'OK' } } }, delete: { tags: ['Cart'], summary: 'Удалить из корзины', security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 204: { description: 'No Content' } } } },
    '/orders': { get: { tags: ['Orders'], summary: 'Заказы пользователя', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' } } }, post: { tags: ['Orders'], summary: 'Создать заказ из корзины', security: [{ sessionCookie: [] }], requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { shippingAddress: { type: 'string' } } } } } }, responses: { 201: { description: 'Created' } } } },
    '/orders/{id}': { get: { tags: ['Orders'], summary: 'Один заказ', security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 200: { description: 'OK' } } } },
    '/orders/{id}/status': { patch: { tags: ['Orders'], summary: 'Изменить статус заказа', security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 200: { description: 'OK' } } } },
    '/profile': { get: { tags: ['Profile'], summary: 'Профиль', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' } } }, patch: { tags: ['Profile'], summary: 'Обновить профиль', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' } } } },
    '/profile/avatar': { post: { tags: ['Profile'], summary: 'Загрузить аватар', security: [{ sessionCookie: [] }], responses: { 200: { description: 'OK' } } } }
  }
};

function idParam() { return { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }; }
function crudPath(tag, schema, parameters = []) { return { get: { tags: [tag], summary: `Список ${tag}`, parameters, responses: { 200: { description: 'OK' } } }, post: { tags: [tag], summary: `Создать ${tag}`, security: [{ sessionCookie: [] }], requestBody: { content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } } }, responses: { 201: { description: 'Created' } } } }; }
function crudIdPath(tag) { return { get: { tags: [tag], summary: `Получить ${tag}`, parameters: [idParam()], responses: { 200: { description: 'OK' } } }, patch: { tags: [tag], summary: `Обновить ${tag}`, security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 200: { description: 'OK' } } }, delete: { tags: [tag], summary: `Удалить ${tag}`, security: [{ sessionCookie: [] }], parameters: [idParam()], responses: { 204: { description: 'No Content' }, 409: { description: 'Conflict' } } } }; }

function setupSwagger(app) {
  app.get('/api-docs/openapi.json', (req, res) => res.json(openApiSpec));
  try {
    const swaggerUi = require('swagger-ui-express');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  } catch (err) {
    app.get('/api-docs', (req, res) => {
      res.type('html').send(`<!doctype html><html lang="ru"><head><title>AgroShop API Docs</title></head><body><h1>AgroShop REST API</h1><p>Swagger UI будет доступен после установки swagger-ui-express.</p><p><a href="/api-docs/openapi.json">OpenAPI JSON</a></p><pre>${JSON.stringify(openApiSpec, null, 2)}</pre></body></html>`);
    });
  }
}

module.exports = { setupSwagger, openApiSpec };
