class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  class BadRequestError extends AppError {
    constructor(message = 'Bad Request') {
      super(message, 400);
    }
  }
  
  class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
      super(message, 401);
    }
  }
  
  class NotFoundError extends AppError {
    constructor(message = 'Not Found') {
      super(message, 404);
    }
  }
  
  class ConflictError extends AppError {
    constructor(message = 'Conflict') {
      super(message, 409);
    }
  }
  
  module.exports = {
    AppError,
    BadRequestError,
    UnauthorizedError,
    NotFoundError,
    ConflictError
  };
  