import Fastify from 'fastify';
import cors from '@fastify/cors';
import { scoresRoutes } from './routes/scores.js';

const app = Fastify({ logger: true });

await app.register(cors);
await app.register(scoresRoutes);

const port = parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });
