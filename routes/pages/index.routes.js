const express = require('express');
const pageData = require('../../services/page-data.service');
const logger = require('../../services/logger.service');

const router = express.Router();

router.get('/', async (req, res) => {
    logger.info(`Сессия на главной: userId=${req.session.userId || 'guest'}, authenticated=${Boolean(req.session.userId)}`);
    try {
      const categories = await pageData.getRootCategories();
      res.render('index', {
        user: req.session.user,
        categories
      });
    } catch (err) {
      logger.error('Ошибка при загрузке главной страницы: ' + err.stack);
      res.status(500).send('Ошибка сервера');
    }
  });

module.exports = router;
