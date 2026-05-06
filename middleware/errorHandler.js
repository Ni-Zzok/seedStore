function createHttpError(status, error, details) {
  const err = new Error(error);
  err.status = status;
  err.details = details;
  return err;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function apiErrorHandler(err, req, res, next) {
  if (!req.originalUrl.startsWith('/api/')) {
    return next(err);
  }

  const status = err.status || (err.code === '23505' ? 409 : err.code === '23503' ? 409 : 500);
  const payload = {
    error: status === 500 ? 'Internal Server Error' : err.message
  };

  if (err.details) {
    payload.details = err.details;
  } else if (err.code === '23503') {
    payload.error = 'Cannot delete entity because it is used by related records';
  } else if (err.code === '23505') {
    payload.error = 'Entity already exists';
  }

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    payload.details = err.message;
  }

  return res.status(status).json(payload);
}

module.exports = { apiErrorHandler, asyncHandler, createHttpError };
