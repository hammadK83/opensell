import { Options } from 'nodemailer/lib/smtp-transport/index.js';
import { env } from '../config/env.js';

/**
 * Mailer configuration
 * Typed using Nodemailer's internal SMTP transport options
 */
export const nodemailerConfig: Options = {
  host: env.EMAIL_HOST,
  port: Number(env.EMAIL_PORT) || 587,
  connectionTimeout: 20_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
  dnsTimeout: 10_000,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS,
  },
};
