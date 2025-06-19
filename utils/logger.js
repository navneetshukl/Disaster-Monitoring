import winston from 'winston';

const { createLogger, format, transports } = winston;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const levelColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(levelColors);

// Create the logger
export const logger = createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    format.colorize({ all: true }),
    format.printf(
      (info) => `[${info.timestamp}] ${info.level}: ${info.message}`
    )
  ),
  transports: [
    new transports.Console(),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

// Create logs directory if it doesn't exist
import fs from 'fs';
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

// Structured logging utilities
export const logAction = (action, details = {}) => {
  logger.info(`Action: ${action}`, { ...details, timestamp: new Date().toISOString() });
};

export const logError = (error, context = {}) => {
  logger.error(`Error: ${error.message}`, { 
    error: error.stack, 
    ...context, 
    timestamp: new Date().toISOString() 
  });
};

export const logApiCall = (method, url, statusCode, responseTime, userId = null) => {
  logger.http(`${method} ${url} - ${statusCode} - ${responseTime}ms`, {
    method,
    url,
    statusCode,
    responseTime,
    userId,
    timestamp: new Date().toISOString()
  });
};
