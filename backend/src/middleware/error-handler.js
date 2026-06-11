import { ApiError } from '../errors/api-error.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
    return;
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    res.status(409).json({
      error: 'Запись нельзя удалить или изменить, потому что на нее ссылаются связанные данные.',
    });
    return;
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    res.status(409).json({
      error: 'Запись с такими уникальными данными уже существует.',
    });
    return;
  }

  if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
    res.status(400).json({
      error: 'Переданы недопустимые значения полей.',
    });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: 'Internal server error',
  });
}
