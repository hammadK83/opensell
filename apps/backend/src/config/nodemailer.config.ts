import { Options } from 'nodemailer/lib/smtp-transport/index.js';

/**
 * Mailer configuration
 * Typed using Nodemailer's internal SMTP transport options
 */
export const nodemailerConfig: Options = {
  host: process.env.EMAIL_HOST || 'smtp.ethereal.email',
  port: Number(process.env.EMAIL_PORT) || 587,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
};
