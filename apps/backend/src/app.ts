import express from 'express';
import { logger } from './middleware/logger.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error-handler.js';
import { authRouter, userRouter, productRouter } from './routes/index.js';
import { env } from './config/env.js';

const app = express();
app.set('trust proxy', env.TRUST_PROXY_HOPS);

app.use(logger);

app.use(express.json());

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/products', productRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
