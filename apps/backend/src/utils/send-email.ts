import nodemailer from 'nodemailer';
import { nodemailerConfig } from '../config/nodemailer.config.js';

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

const transporter = nodemailer.createTransport(nodemailerConfig);

export const sendEmail = async ({ to, subject, html }: SendEmailOptions) => {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
};
