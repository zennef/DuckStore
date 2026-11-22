import { ConflictException, NotFoundException } from '@nestjs/common';
import { Color, Duck, Size } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DucksService } from './ducks.service';

function duck(overrides: Partial<Duck>): Duck {
  return {
    id: 1,
    color: Color.Green,
    size: Size.Medium,
    price: 15,
    quantity: 100,
    deleted: false,
    ...overrides,
  };
}

describe('DucksService', () => {
  const findMany = jest.fn();
  const updateMany = jest.fn();
  const prisma = { duck: { findMany, updateMany } } as unknown as PrismaService;
  const service = new DucksService(prisma);

  beforeEach(() => jest.resetAllMocks());

  describe('findCheapestMatch', () => {
    it('queries only non-deleted ducks of the requested color and size', async () => {
      findMany.mockResolvedValue([duck({})]);
      await service.findCheapestMatch(Color.Green, Size.Medium, 10);
      expect(findMany).toHaveBeenCalledWith({
        where: { color: Color.Green, size: Size.Medium, deleted: false },
      });
    });

    it('throws 404 when no duck has that color and size', async () => {
      findMany.mockResolvedValue([]);
      await expect(service.findCheapestMatch(Color.Red, Size.Small, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 409 when matches exist but none has enough stock', async () => {
      findMany.mockResolvedValue([duck({ id: 1, quantity: 5 }), duck({ id: 2, quantity: 9 })]);
      await expect(service.findCheapestMatch(Color.Green, Size.Medium, 10)).rejects.toThrow(
        ConflictException,
      );
    });

    it('picks the lowest price among ducks with enough stock', async () => {
      findMany.mockResolvedValue([
        duck({ id: 1, price: 20, quantity: 500 }),
        duck({ id: 2, price: 10, quantity: 5 }), // cheapest overall, but not enough stock
        duck({ id: 3, price: 12.5, quantity: 50 }),
        duck({ id: 4, price: 15, quantity: 50 }),
      ]);
      const chosen = await service.findCheapestMatch(Color.Green, Size.Medium, 50);
      expect(chosen.id).toBe(3);
    });

    it('accepts a duck whose stock exactly equals the requested quantity', async () => {
      findMany.mockResolvedValue([duck({ id: 7, quantity: 50 })]);
      await expect(service.findCheapestMatch(Color.Green, Size.Medium, 50)).resolves.toMatchObject(
        { id: 7 },
      );
    });

    it('breaks price ties by lowest id', async () => {
      findMany.mockResolvedValue([
        duck({ id: 9, price: 15 }),
        duck({ id: 4, price: 15 }),
        duck({ id: 6, price: 15 }),
      ]);
      const chosen = await service.findCheapestMatch(Color.Green, Size.Medium, 10);
      expect(chosen.id).toBe(4);
    });
  });

  describe('decrementStock', () => {
    it('throws 409 asking for a retry when the price no longer matches', async () => {
      // The WHERE includes the price the order was priced at, so a price edit since then
      // makes the update match zero rows.
      updateMany.mockResolvedValue({ count: 0 });
      const priced = duck({ id: 3, price: 15 });

      const attempt = service.decrementStock(priced, 40);
      await expect(attempt).rejects.toThrow(ConflictException);
      await expect(attempt).rejects.toThrow(
        'Duck 3 changed or no longer has 40 in stock, please retry',
      );
      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 3, price: 15 }) }),
      );
    });

    it('decrements with a conditional update on id, price, deleted and stock', async () => {
      updateMany.mockResolvedValue({ count: 1 });
      await expect(
        service.decrementStock(duck({ id: 3, price: 15 }), 40),
      ).resolves.toBeUndefined();
      expect(updateMany).toHaveBeenCalledWith({
        where: { id: 3, price: 15, deleted: false, quantity: { gte: 40 } },
        data: { quantity: { decrement: 40 } },
      });
    });

    it('throws 409 when zero rows update, without trying another duck', async () => {
      updateMany.mockResolvedValue({ count: 0 });
      await expect(service.decrementStock(duck({ id: 3 }), 40)).rejects.toThrow(ConflictException);
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(findMany).not.toHaveBeenCalled();
    });
  });
});
