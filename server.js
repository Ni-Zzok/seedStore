require('dotenv').config();

const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { Server } = require('socket.io');

const pool = require('./db/pool');
const logger = require('./services/logger.service');
const stats = require('./services/stats.service');
const { apiErrorHandler } = require('./middleware/errorHandler');
const { setupSwagger } = require('./swagger/swagger');
const setupChatSocket = require('./realtime/chat.socket');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const httpsKeyPath = process.env.HTTPS_KEY_PATH;
const httpsCertPath = process.env.HTTPS_CERT_PATH;
const httpsEnabled = Boolean(httpsKeyPath && httpsCertPath);

if (httpsEnabled) {
  app.set('trust proxy', 1);
}

const server = httpsEnabled
  ? https.createServer({
      key: fs.readFileSync(httpsKeyPath),
      cert: fs.readFileSync(httpsCertPath)
    }, app)
  : http.createServer(app);
const io = new Server(server);

pool.connect()
  .then((client) => {
    logger.info('Успешно подключено к PostgreSQL');
    client.release();
  })
  .catch((err) => logger.error('Ошибка подключения к БД:', err));

const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'default_secret',
  store: new PgSession({
    pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: httpsEnabled,
    maxAge: 86400000,
    sameSite: 'lax'
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${req.session.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Файл должен быть изображением'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(sessionMiddleware);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});
setupChatSocket(io);

app.use((req, res, next) => {
  const visitTracked = req.cookies.visitTracked;
  if (!visitTracked) {
    stats.trackVisit();
    res.cookie('visitTracked', 'true', {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: httpsEnabled
    });
  }
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

if (!isProduction) {
  const schedule = require('node-schedule');
  schedule.scheduleJob('0 0 * * *', () => {
    stats.logDailyStats();
    logger.info('Ежедневная статистика записана');
  });
}

if (isProduction) {
  app.get('/cron/daily-stats', (req, res) => {
    stats.logDailyStats();
    logger.info('Ежедневная статистика записана (по расписанию)');
    res.status(200).send('OK');
  });
}

app.use('/api', require('./routes/api')(upload));
setupSwagger(app);
app.use(apiErrorHandler);
app.use(require('./routes/pages')(upload));

app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).render('error', {
    message: 'Ошибка сервера',
    user: req.session?.user || null
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  const protocol = httpsEnabled ? 'https' : 'http';
  logger.info(`Сервер запущен на ${protocol}://localhost:${PORT}`);
  if (!httpsEnabled) {
    logger.warn('HTTPS отключён. Укажите HTTPS_KEY_PATH и HTTPS_CERT_PATH для запуска по HTTPS.');
  }
});
