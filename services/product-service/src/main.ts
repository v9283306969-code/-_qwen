import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.SERVICE_PORT || process.env.PORT || '3001', 10);

app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'product-service', timestamp: new Date().toISOString() });
});

app.get('/api/v1/products', (_req: Request, res: Response) => {
  res.json({ products: [], note: 'Product API — в разработке (Этап 3)' });
});

app.listen(PORT, () => {
  console.log(`[product-service] Scaffold running on port ${PORT}`);
});
