import morgan from 'morgan';
import { env } from '../config/env.js';

export const logger = env.NODE_ENV !== 'production' ? morgan('dev') : morgan('combined');
