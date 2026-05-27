import express, { Request, Response } from 'express';

const app = express();
const PORT = parseInt(process.env.GATEWAY_PORT || process.env.PORT || '4000', 10);

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() });
});

// Stub: GraphQL endpoint placeholder
app.get('/', (_req: Request, res: Response) => {
  res.json({
    service: 'gateway',
    version: '0.1.0-scaffold',
    note: 'GraphQL endpoint — в разработке (Этап 3)',
  });
});

app.listen(PORT, () => {
  console.log(`[gateway] Scaffold running on port ${PORT}`);
});
