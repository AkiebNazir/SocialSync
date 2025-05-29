import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';

// Define log levels and colors
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

// Add colors to winston
winston.addColors(colors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!require('fs').existsSync(logsDir)) {
    require('fs').mkdirSync(logsDir, { recursive: true });
}

// Create a rotating file transport
const fileRotateTransport = new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'whatsapp-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '14d', // Keep logs for 14 days
    maxSize: '20m', // Rotate when file reaches 20MB
    zippedArchive: true, // Compress rotated files
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    )
});

// Create console transport with colors
const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
            const contextStr = context ? `[${context}] ` : '';
            const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
            return `${timestamp} ${level}: ${contextStr}${message} ${metaStr}`;
        })
    )
});

// Create the logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'whatsapp-service' },
    transports: [
        fileRotateTransport,
        consoleTransport
    ],
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Sanitize sensitive data
function sanitizeData(data: any): any {
    if (!data) return data;
    
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth', 'session'];
    const sanitized = { ...data };
    
    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }
    
    return sanitized;
}

// Create a context-aware logger
export function createLogger(context: string) {
    return {
        error: (message: string, meta?: any) => {
            logger.error(message, { context, ...sanitizeData(meta) });
        },
        warn: (message: string, meta?: any) => {
            logger.warn(message, { context, ...sanitizeData(meta) });
        },
        info: (message: string, meta?: any) => {
            logger.info(message, { context, ...sanitizeData(meta) });
        },
        http: (message: string, meta?: any) => {
            logger.http(message, { context, ...sanitizeData(meta) });
        },
        debug: (message: string, meta?: any) => {
            logger.debug(message, { context, ...sanitizeData(meta) });
        }
    };
}

// Export the base logger for direct use
export { logger };