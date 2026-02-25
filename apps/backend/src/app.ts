import express from 'express';
import notFound from './middleware/not-found';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).send('<h1>Home Page</h1>');
});

app.use(notFound);

export default app;
