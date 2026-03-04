import express from 'express';
import { logger } from './middleware/logger.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error-handler.js';
import { authRouter } from './routes/auth.routes.js';

const app = express();

app.use(logger);

app.use(express.json());

app.use('/api/v1/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
