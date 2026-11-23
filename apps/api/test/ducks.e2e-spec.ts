import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Color, Prisma, Size } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DucksService } from '../src/ducks/ducks.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Ducks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const api = () => request(app.getHttpServer());

  function seed(duck: Partial<Prisma.DuckCreateInput> = {}) {
    return prisma.duck.create({
      data: { color: Color.Red, size: Size.Large, price: 20, quantity: 10, ...duck },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    // TRUNCATE also resets AUTO_INCREMENT, so ids are predictable per test.
    await prisma.$executeRawUnsafe('TRUNCATE TABLE ducks');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/ducks', () => {
    it('lists non-deleted ducks by quantity desc, then id asc', async () => {
      const a = await seed({ quantity: 5 });
      const b = await seed({ quantity: 50, color: Color.Green });
      await seed({ quantity: 999, deleted: true });
      const c = await seed({ quantity: 5, color: Color.Yellow });

      const res = await api().get('/api/ducks').expect(200);
      expect(res.body.map((d: { id: number }) => d.id)).toEqual([b.id, a.id, c.id]);
    });
  });

  describe('POST /api/ducks', () => {
    const body = { color: 'Green', size: 'Medium', price: 15, quantity: 100 };

    it('creates a new duck with 201', async () => {
      const res = await api().post('/api/ducks').send(body).expect(201);
      expect(res.body).toEqual({
        merged: false,
        duck: { id: 1, ...body, deleted: false },
      });
    });

    it('merges into a matching duck with 200 and sums quantity', async () => {
      const existing = await seed({
        color: Color.Green,
        size: Size.Medium,
        price: 15,
        quantity: 40,
      });

      const res = await api().post('/api/ducks').send(body).expect(200);
      expect(res.body).toEqual({ merged: true, duck: { ...existing, quantity: 140 } });
      expect(await prisma.duck.count()).toBe(1);
    });

    it('ignores deleted ducks when matching', async () => {
      const deleted = await seed({
        color: Color.Green,
        size: Size.Medium,
        price: 15,
        quantity: 40,
        deleted: true,
      });

      const res = await api().post('/api/ducks').send(body).expect(201);
      expect(res.body.merged).toBe(false);
      expect(res.body.duck.id).not.toBe(deleted.id);
      expect(await prisma.duck.findUnique({ where: { id: deleted.id } })).toMatchObject({
        quantity: 40,
        deleted: true,
      });
    });

    it('creates a new record when only the price differs', async () => {
      await seed({ color: Color.Green, size: Size.Medium, price: 15.5, quantity: 40 });

      const res = await api().post('/api/ducks').send(body).expect(201);
      expect(res.body.merged).toBe(false);
      expect(await prisma.duck.count()).toBe(2);
    });

    it.each([
      ['an unknown color', { color: 'Purple' }, 'color'],
      ['an unknown size', { size: 'Huge' }, 'size'],
      ['price 0', { price: 0 }, 'price'],
      ['a price with 3 decimal places', { price: 15.125 }, 'price'],
      ['a non-integer quantity', { quantity: 1.5 }, 'quantity'],
      ['quantity 0', { quantity: 0 }, 'quantity'],
    ])('rejects %s with 400', async (_label, override, field) => {
      const res = await api()
        .post('/api/ducks')
        .send({ ...body, ...override })
        .expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(res.body.message.some((m: string) => m.startsWith(field))).toBe(true);
      expect(await prisma.duck.count()).toBe(0);
    });
  });

  describe('PATCH /api/ducks/:id', () => {
    it('updates price and quantity', async () => {
      const duck = await seed();
      const res = await api()
        .patch(`/api/ducks/${duck.id}`)
        .send({ price: 22.5, quantity: 7 })
        .expect(200);
      expect(res.body).toEqual({ merged: false, duck: { ...duck, price: 22.5, quantity: 7 } });
    });

    it('allows quantity 0', async () => {
      const duck = await seed();
      const res = await api().patch(`/api/ducks/${duck.id}`).send({ quantity: 0 }).expect(200);
      expect(res.body.duck.quantity).toBe(0);
    });

    it.each([
      ['color', { color: 'Green' }],
      ['size', { size: 'Small' }],
    ])('rejects %s in the body with 400', async (field, extra) => {
      const duck = await seed();
      const res = await api()
        .patch(`/api/ducks/${duck.id}`)
        .send({ quantity: 3, ...extra })
        .expect(400);
      expect(res.body.message).toContain(`property ${field} should not exist`);
      expect(await prisma.duck.findUnique({ where: { id: duck.id } })).toEqual(duck);
    });

    it('rejects an empty body with 400', async () => {
      const duck = await seed();
      await api().patch(`/api/ducks/${duck.id}`).send({}).expect(400);
    });

    it('auto-merges into an identical duck when the edit collides', async () => {
      const a = await seed({ price: 18, quantity: 30 });
      const b = await seed({ price: 20, quantity: 100 });

      const res = await api()
        .patch(`/api/ducks/${a.id}`)
        .send({ price: 20, quantity: 25 })
        .expect(200);

      expect(res.body).toEqual({ merged: true, duck: { ...b, quantity: 125 } });
      // A is soft-deleted and keeps its pre-edit values as history.
      expect(await prisma.duck.findUnique({ where: { id: a.id } })).toEqual({
        ...a,
        deleted: true,
      });
      const list = await api().get('/api/ducks').expect(200);
      expect(list.body).toEqual([{ ...b, quantity: 125 }]);
    });

    it('does not merge into a deleted duck', async () => {
      const a = await seed({ price: 18 });
      await seed({ price: 20, deleted: true });

      const res = await api().patch(`/api/ducks/${a.id}`).send({ price: 20 }).expect(200);
      expect(res.body).toEqual({ merged: false, duck: { ...a, price: 20 } });
    });

    it('returns 404 for a deleted duck', async () => {
      const duck = await seed({ deleted: true });
      const res = await api().patch(`/api/ducks/${duck.id}`).send({ quantity: 1 }).expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        message: `Duck ${duck.id} not found`,
        error: 'Not Found',
      });
    });

    it('returns 404 for a missing duck', async () => {
      await api().patch('/api/ducks/12345').send({ quantity: 1 }).expect(404);
    });

    it('does not lose concurrent stock decrements during price-only edits', async () => {
      // The edits resend the current price: decrementStock requires the price it was given,
      // so a real price change would (correctly) 409 the decrements that follow it. Each
      // edit is still price-only, which is what used to write a stale quantity back.
      const duck = await seed({ quantity: 1000, price: 20 });
      const ducks = app.get(DucksService);

      const decrements = Array.from({ length: 20 }, () => ducks.decrementStock(duck, 10));
      const edits = Array.from({ length: 20 }, () =>
        api().patch(`/api/ducks/${duck.id}`).send({ price: 20 }).expect(200),
      );
      await Promise.all([...decrements, ...edits]);

      const final = await prisma.duck.findUniqueOrThrow({ where: { id: duck.id } });
      expect(final).toMatchObject({ quantity: 800, price: 20, deleted: false });
    });
  });

  describe('DELETE /api/ducks/:id', () => {
    it('soft-deletes with 204', async () => {
      const duck = await seed();
      await api().delete(`/api/ducks/${duck.id}`).expect(204);

      expect(await prisma.duck.findUnique({ where: { id: duck.id } })).toEqual({
        ...duck,
        deleted: true,
      });
      const list = await api().get('/api/ducks').expect(200);
      expect(list.body).toEqual([]);
    });

    it('returns 404 for an already deleted duck', async () => {
      const duck = await seed({ deleted: true });
      await api().delete(`/api/ducks/${duck.id}`).expect(404);
    });

    it('returns 404 for a missing duck', async () => {
      await api().delete('/api/ducks/12345').expect(404);
    });
  });
});
