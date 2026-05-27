import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.SERVICE_PORT || process.env.PORT || '3002', 10);

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service', timestamp: new Date().toISOString() });
});

app.get('/api/v1/orders', (_req: Request, res: Response) => {
  res.json({ orders: [], note: 'Order API — в разработке (Этап 3)' });
});

app.listen(PORT, () => {
  console.log(`[order-service] Scaffold running on port ${PORT}`);
});
