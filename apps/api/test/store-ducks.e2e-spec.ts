import { Color, Size } from '@prisma/client';
import { createTestApp, TestApp } from './helpers/test-app';

/** Smoke tests that /api/store/ducks behaves like /api/ducks. Full coverage is in ducks.e2e-spec. */
describe('Store ducks (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => t.reset());

  afterAll(() => t.app.close());

  it('lists the same ducks as /api/ducks', async () => {
    await t.seed({ quantity: 5 });
    await t.seed({ quantity: 50, color: Color.Green });
    await t.seed({ quantity: 999, deleted: true });

    const store = await t.api().get('/api/store/ducks').expect(200);
    const warehouse = await t.api().get('/api/ducks').expect(200);
    expect(store.body).toHaveLength(2);
    expect(store.body).toEqual(warehouse.body);
  });

  it('adds with 201, then merges with 200', async () => {
    const body = { color: 'Green', size: 'Medium', price: 15, quantity: 100 };

    const created = await t.api().post('/api/store/ducks').send(body).expect(201);
    expect(created.body).toEqual({ merged: false, duck: { id: 1, ...body, deleted: false } });

    const merged = await t.api().post('/api/store/ducks').send(body).expect(200);
    expect(merged.body).toEqual({ merged: true, duck: { id: 1, ...body, quantity: 200, deleted: false } });
  });

  it('edits price and quantity, and rejects color', async () => {
    const duck = await t.seed({ color: Color.Yellow, size: Size.Small });

    const res = await t
      .api()
      .patch(`/api/store/ducks/${duck.id}`)
      .send({ price: 11.25, quantity: 0 })
      .expect(200);
    expect(res.body).toEqual({ merged: false, duck: { ...duck, price: 11.25, quantity: 0 } });

    await t.api().patch(`/api/store/ducks/${duck.id}`).send({ color: 'Red' }).expect(400);
  });

  it('soft-deletes with 204, then 404s', async () => {
    const duck = await t.seed();

    await t.api().delete(`/api/store/ducks/${duck.id}`).expect(204);
    expect(await t.prisma.duck.findUnique({ where: { id: duck.id } })).toMatchObject({
      deleted: true,
    });
    await t.api().delete(`/api/store/ducks/${duck.id}`).expect(404);
  });
});
