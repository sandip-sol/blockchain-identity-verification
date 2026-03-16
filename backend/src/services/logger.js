const winston = require('winston');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
    level: IS_PRODUCTION ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        IS_PRODUCTION
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
                    let line = `${timestamp} ${level}: ${message}`;
                    if (stack) line += `\n${stack}`;
                    if (Object.keys(meta).length > 0) line += ` ${JSON.stringify(meta)}`;
                    return line;
                })
            )
    ),
    defaultMeta: { service: 'kyc-kyb-api' },
    transports: [
        new winston.transports.Console()
    ]
});

// In production, also log errors to a file for persistence
if (IS_PRODUCTION) {
    logger.add(new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
    }));
    logger.add(new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880,
        maxFiles: 5
    }));
}

module.exports = logger;
