import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health.js';
import tradesRouter from './routes/trades.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/health', healthRouter);
app.use('/api/trades', tradesRouter);

app.listen(PORT, () => {
  console.log(`[quantflow-server] Running on http://localhost:${PORT}`);
  console.log(`[quantflow-server] Health: http://localhost:${PORT}/api/health`);
});
