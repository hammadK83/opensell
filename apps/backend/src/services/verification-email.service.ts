import crypto from 'node:crypto';
import { User, type IVerificationEmailJob } from '../models/user.model.js';
import { env } from '../config/env.js';
import { generateVerificationToken } from '../utils/generate-verification-token.js';
import { sendVerificationEmail } from '../utils/send-verification-email.js';
import { encryptVerificationToken, decryptVerificationToken } from '../utils/verification-email-crypto.js';

const RESEND_COOLDOWN_MS = 60_000;
const LEASE_MS = 30_000;
const POLL_MS = 1_000;
const MAX_ACTIVE_SENDS = 4;
export const MAX_AUTOMATIC_ATTEMPTS = 5;

export const RESEND_CONFIRMATION =
  'If this email belongs to an unverified account, a verification link may arrive. If it does not, try again later.';

export function createVerificationEmailJob(token = generateVerificationToken()): {
  pendingVerificationToken: string;
  verificationEmailJob: IVerificationEmailJob;
} {
  return {
    pendingVerificationToken: token.tokenHash,
    verificationEmailJob: {
      ...encryptVerificationToken(token.rawToken),
      tokenHash: token.tokenHash,
      nextAttemptAt: new Date(),
      attempts: 0,
    },
  };
}

export async function requestVerificationEmail(email: string): Promise<void> {
  const now = new Date();
  const candidate = createVerificationEmailJob();
  const cooldown = [
    { verificationResendAfter: { $exists: false } },
    { verificationResendAfter: { $lte: now } },
  ];
  const leaseAvailable = [
    { 'verificationEmailJob.leaseUntil': { $exists: false } },
    { 'verificationEmailJob.leaseUntil': { $lte: now } },
  ];
  // Restart an exhausted job with its original link, which may already have been accepted by SMTP.
  await User.findOneAndUpdate(
    {
      email,
      isVerified: false,
      'verificationEmailJob.attempts': { $gte: MAX_AUTOMATIC_ATTEMPTS },
      $and: [{ $or: cooldown }, { $or: leaseAvailable }],
    },
    {
      $set: {
        'verificationEmailJob.attempts': 0,
        'verificationEmailJob.nextAttemptAt': now,
        verificationResendAfter: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      },
      $unset: { 'verificationEmailJob.leaseId': 1, 'verificationEmailJob.leaseUntil': 1 },
    },
  );
  await User.findOneAndUpdate(
    {
      email,
      isVerified: false,
      verificationEmailJob: { $exists: false },
      $or: cooldown,
    },
    {
      $set: {
        ...candidate,
        verificationResendAfter: new Date(now.getTime() + RESEND_COOLDOWN_MS),
      },
    },
  );
}

function nextRetryAt(attempts: number): Date {
  return new Date(Date.now() + Math.min(60_000, 1_000 * 2 ** Math.min(attempts, 6)));
}

export async function processNextVerificationEmail(): Promise<boolean> {
  const now = new Date();
  const leaseId = crypto.randomUUID();
  const user = await User.findOneAndUpdate(
    {
      isVerified: false,
      'verificationEmailJob.nextAttemptAt': { $lte: now },
      'verificationEmailJob.attempts': { $lt: MAX_AUTOMATIC_ATTEMPTS },
      $or: [
        { 'verificationEmailJob.leaseUntil': { $exists: false } },
        { 'verificationEmailJob.leaseUntil': { $lte: now } },
      ],
    },
    {
      $set: {
        'verificationEmailJob.leaseId': leaseId,
        'verificationEmailJob.leaseUntil': new Date(now.getTime() + LEASE_MS),
      },
      // Reserve an attempt before SMTP starts so crashes and expired leases consume the budget.
      $inc: { 'verificationEmailJob.attempts': 1 },
    },
    { new: true, sort: { 'verificationEmailJob.nextAttemptAt': 1 } },
  );
  if (!user?.verificationEmailJob) return false;

  const job = user.verificationEmailJob;
  const filter = {
    _id: user._id,
    isVerified: false,
    pendingVerificationToken: job.tokenHash,
    'verificationEmailJob.leaseId': leaseId,
  };
  try {
    const rawToken = decryptVerificationToken(job);
    const result = await sendVerificationEmail({
      name: user.name,
      email: user.email,
      verificationToken: rawToken,
      origin: env.API_URL,
    });
    if (!Array.isArray(result.accepted) || !result.accepted.includes(user.email)) {
      throw new Error('SMTP did not accept the verification recipient');
    }
    await User.updateOne(filter, {
      $set: { verificationToken: job.tokenHash },
      $unset: { pendingVerificationToken: 1, verificationEmailJob: 1 },
    });
  } catch (error) {
    console.error('Verification email delivery attempt failed:', error);
    await User.updateOne(filter, {
      $set: { 'verificationEmailJob.nextAttemptAt': nextRetryAt(job.attempts - 1) },
      $unset: { 'verificationEmailJob.leaseId': 1, 'verificationEmailJob.leaseUntil': 1 },
    });
  }
  return true;
}

export function startVerificationEmailWorker() {
  let stopped = false;
  const active = new Set<Promise<void>>();
  const tick = () => {
    while (!stopped && active.size < MAX_ACTIVE_SENDS) {
      let processed = false;
      const task = processNextVerificationEmail()
        .then((result) => { processed = result; })
        .catch((error) => { console.error('Verification email worker error:', error); })
        .finally(() => {
          active.delete(task);
          if (processed && !stopped) tick();
        });
      active.add(task);
    }
  };
  const timer = setInterval(tick, POLL_MS);
  timer.unref();
  tick();
  return {
    stop: async () => {
      stopped = true;
      clearInterval(timer);
      await Promise.allSettled([...active]);
    },
  };
}
