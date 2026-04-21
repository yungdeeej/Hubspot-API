import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'payload.email',
      'payload.firstName',
      'payload.lastName',
      'payload.mobilePhone',
      '*.password',
      '*.password_hash'
    ],
    censor: '[REDACTED]'
  },
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss' }
    }
  })
});
