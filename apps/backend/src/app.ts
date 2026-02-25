import express from 'express';
import notFound from './middleware/not-found';
import { authRouter } from './routes/auth.routes';

const app = express();

app.use(express.json());

app.use('/api/v1/auth', authRouter);

app.use(notFound);

export default app;
