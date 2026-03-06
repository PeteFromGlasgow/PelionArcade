import type { FastifyInstance } from 'fastify';
import db from '../db.js';

interface SubmitBody {
  game: string;
  player: string;
  score: number;
}

interface GameParams {
  game: string;
}

interface LeaderboardQuery {
  limit?: string;
  date?: string;
}

export async function scoresRoutes(app: FastifyInstance) {
  app.post<{ Body: SubmitBody }>(
    '/scores',
    {
      schema: {
        body: {
          type: 'object',
          required: ['game', 'player', 'score'],
          properties: {
            game: { type: 'string', minLength: 1 },
            player: { type: 'string', minLength: 1 },
            score: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { game, player, score } = request.body;
      const [id] = await db('scores').insert({ game, player, score });
      return reply.code(201).send({ id });
    },
  );

  app.get<{ Params: GameParams; Querystring: LeaderboardQuery }>(
    '/scores/:game/daily',
    async (request) => {
      const { game } = request.params;
      const { date, limit = '10' } = request.query;
      const day = date ?? new Date().toISOString().slice(0, 10);
      const scores = await db('scores')
        .where('game', game)
        .whereRaw('date(created_at) = ?', [day])
        .orderBy('score', 'desc')
        .limit(parseInt(limit, 10))
        .select('player', 'score', 'created_at');
      return { game, date: day, scores };
    },
  );

  app.get<{ Params: GameParams; Querystring: LeaderboardQuery }>(
    '/scores/:game/alltime',
    async (request) => {
      const { game } = request.params;
      const { limit = '10' } = request.query;
      const scores = await db('scores')
        .where('game', game)
        .orderBy('score', 'desc')
        .limit(parseInt(limit, 10))
        .select('player', 'score', 'created_at');
      return { game, scores };
    },
  );
}
