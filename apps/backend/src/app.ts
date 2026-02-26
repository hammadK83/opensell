import express from 'express';
import notFound from './middleware/not-found';
import errorHandler from './middleware/error-handler';
import { authRouter } from './routes/auth.routes';

const app = express();

app.use(express.json());

app.use('/api/v1/auth', authRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
