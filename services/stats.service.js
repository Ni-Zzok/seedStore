const logger = require('./logger.service');

let dailyStats = {
  visits: 0,
  productOrders: {}
};

const statsLogger = {
  info: (data) => logger.info(`[STATS] ${JSON.stringify(data)}`)
};

function getDailyStats() {
  return dailyStats;
}

function trackVisit() {
  dailyStats.visits++;
}

function trackProductOrder(article, quantity) {
  dailyStats.productOrders[article] = (dailyStats.productOrders[article] || 0) + quantity;
}

function logDailyStats() {
  statsLogger.info(dailyStats);
  dailyStats = {
    visits: 0,
    productOrders: {}
  };
}

module.exports = {
  getDailyStats,
  trackVisit,
  trackProductOrder,
  logDailyStats,
  statsLogger
};
