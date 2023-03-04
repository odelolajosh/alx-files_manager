import express from 'express';
import router from './routes';

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', router);

app.listen(PORT, HOST, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default app;
