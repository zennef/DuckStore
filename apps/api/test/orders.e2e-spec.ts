import { Color, Size } from '@prisma/client';
import { createTestApp, TestApp } from './helpers/test-app';

describe('Orders (e2e)', () => {
  let t: TestApp;

  const order = (overrides: object = {}) =>
    t
      .api()
      .post('/api/store/orders')
      .send({
        color: 'Green',
        size: 'Medium',
        quantity: 150,
        country: 'USA',
        shippingMode: 'AIR',
        ...overrides,
      });

  const quantityOf = async (id: number) =>
    (await t.prisma.duck.findUniqueOrThrow({ where: { id } })).quantity;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => t.reset());

  afterAll(() => t.app.close());

  it('prices the CLAUDE.md worked example: 150 Green Medium @ $15 to USA by AIR', async () => {
    const duck = await t.seed({
      color: Color.Green,
      size: Size.Medium,
      price: 15,
      quantity: 500,
    });

    const res = await order().expect(201);
    expect(res.body).toEqual({
      duckId: duck.id,
      packageType: 'CARDBOARD',
      protection: ['POLYSTYRENE_BALLS'],
      lineItems: [
        { label: 'Base cost (150 x $15.00)', amount: 2250, type: 'charge' },
        { label: 'Volume discount (20%)', amount: -450, type: 'discount' },
        { label: 'Cardboard discount (1%)', amount: -18, type: 'discount' },
        { label: 'USA tax (18%)', amount: 320.76, type: 'charge' },
        { label: 'Air shipping (150 x $30)', amount: 4500, type: 'charge' },
      ],
      total: 6602.76,
    });
  });

  it('decrements stock by the order quantity', async () => {
    const duck = await t.seed({ color: Color.Green, size: Size.Medium, quantity: 500 });
    await order({ quantity: 150 }).expect(201);
    expect(await quantityOf(duck.id)).toBe(350);
  });

  it('draws from the cheapest duck with enough stock', async () => {
    const pricey = await t.seed({ color: Color.Green, size: Size.Medium, price: 15, quantity: 500 });
    await t.seed({ color: Color.Green, size: Size.Medium, price: 9, quantity: 100 }); // too few
    const cheapest = await t.seed({
      color: Color.Green,
      size: Size.Medium,
      price: 12,
      quantity: 200,
    });
    await t.seed({ color: Color.Red, size: Size.Medium, price: 1, quantity: 999 }); // wrong color

    const res = await order({ quantity: 150 }).expect(201);
    expect(res.body.duckId).toBe(cheapest.id);
    expect(res.body.lineItems[0].label).toBe('Base cost (150 x $12.00)');
    expect(await quantityOf(cheapest.id)).toBe(50);
    expect(await quantityOf(pricey.id)).toBe(500);
  });

  it('never draws from a deleted duck', async () => {
    const deleted = await t.seed({
      color: Color.Green,
      size: Size.Medium,
      price: 1,
      quantity: 999,
      deleted: true,
    });
    const live = await t.seed({ color: Color.Green, size: Size.Medium, price: 15, quantity: 500 });

    const res = await order().expect(201);
    expect(res.body.duckId).toBe(live.id);
    expect(await quantityOf(deleted.id)).toBe(999);
  });

  it('returns 404 when no duck has that color and size', async () => {
    await t.seed({ color: Color.Green, size: Size.Large, quantity: 500 });
    await t.seed({ color: Color.Green, size: Size.Medium, quantity: 500, deleted: true });

    const res = await order().expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('returns 409 when no match has enough stock, leaving stock untouched', async () => {
    const a = await t.seed({ color: Color.Green, size: Size.Medium, quantity: 100 });
    const b = await t.seed({ color: Color.Green, size: Size.Medium, price: 18, quantity: 149 });

    const res = await order({ quantity: 150 }).expect(409);
    expect(res.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
    expect(await quantityOf(a.id)).toBe(100);
    expect(await quantityOf(b.id)).toBe(149);
  });

  it('lets only one of two concurrent orders through when only one fits', async () => {
    const duck = await t.seed({ color: Color.Green, size: Size.Medium, quantity: 100 });

    const results = await Promise.all([order({ quantity: 60 }), order({ quantity: 60 })]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const remaining = await quantityOf(duck.id);
    expect(remaining).toBe(40);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('applies USA tax to the "US" alias', async () => {
    await t.seed({ color: Color.Green, size: Size.Medium, price: 15, quantity: 500 });
    const res = await order({ country: '  us ' }).expect(201);
    expect(res.body.lineItems[3]).toEqual({
      label: 'USA tax (18%)',
      amount: 320.76,
      type: 'charge',
    });
    expect(res.body.total).toBe(6602.76);
  });

  it.each([
    ['an unknown color', { color: 'Purple' }, 'color'],
    ['an unknown size', { size: 'Huge' }, 'size'],
    ['an unknown shipping mode', { shippingMode: 'ROCKET' }, 'shippingMode'],
    ['quantity 0', { quantity: 0 }, 'quantity'],
    ['a non-integer quantity', { quantity: 1.5 }, 'quantity'],
    ['an empty country', { country: '' }, 'country'],
    ['a whitespace-only country', { country: '   ' }, 'country'],
    ['a missing country', { country: undefined }, 'country'],
  ])('rejects %s with 400', async (_label, override, field) => {
    const duck = await t.seed({ color: Color.Green, size: Size.Medium, quantity: 500 });

    const res = await order(override).expect(400);
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
    expect(res.body.message.some((m: string) => m.startsWith(field))).toBe(true);
    expect(await quantityOf(duck.id)).toBe(500);
  });
});
