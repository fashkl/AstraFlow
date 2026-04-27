const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const level = process.env.LOG_LEVEL ?? (isProduction ? 'info' : isTest ? 'silent' : 'debug');

export const pinoHttpConfig = {
  autoLogging: !isTest,
  level,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  transport:
    isProduction || isTest
      ? undefined
      : {
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            singleLine: true,
            translateTime: 'SYS:standard',
          },
          target: 'pino-pretty',
        },
};
