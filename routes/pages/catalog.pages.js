const express = require('express');
const pageData = require('../../services/page-data.service');
const logger = require('../../services/logger.service');

const router = express.Router();

router.get('/catalog', async (req, res) => {
    const { search, sort, category, inStock } = req.query;
    try {
        const categories = await pageData.getAllCategories();
        res.render('catalog', {
            products: [],
            categories,
            searchQuery: search || '',
            sort: sort || 'name_asc',
            categoryId: category || '',
            inStock: inStock || '',
            user: req.session.user || null
        });
    } catch (err) {
        logger.error('Ошибка при загрузке каталога: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});

router.get('/product/:article', async (req, res) => {
    const article = req.params.article;
    try {
        const product = await pageData.getProductPageByArticle(article);
        if (!product) {
            return res.status(404).send('Товар не найден');
        }
        res.render('product', {
            product,
            user: req.session.user || null
        });
    } catch (err) {
        logger.error('Ошибка при загрузке страницы товара: ' + err.stack);
        res.status(500).send('Ошибка сервера');
    }
});


module.exports = router;
