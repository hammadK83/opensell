import { sendEmail } from '../utils/index.js';

interface VerificationEmailOptions {
  name: string;
  email: string;
  verificationToken: string;
  origin: string;
}

export const sendVerificationEmail = async ({
  name,
  email,
  verificationToken,
  origin,
}: VerificationEmailOptions) => {
  const verifyEmailLink = `${origin}/user/verify-email?token=${verificationToken}&email=${email}`;

  const message = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
      <h2 style="color: #333;">Hello, ${name}</h2>
      <p>Please confirm your email by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verifyEmailLink}" 
           style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
           Verify Email
        </a>
      </div>
      <p style="font-size: 0.8em; color: #777;">If the button doesn't work, copy and paste this link: <br> ${verifyEmailLink}</p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject: 'Email Confirmation - OpenSell',
    html: message,
  });
};
