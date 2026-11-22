import { ConflictException, NotFoundException } from '@nestjs/common';
import { Color, Duck, Size } from '@prisma/client';
import { DucksService } from '../../ducks/ducks.service';
import { PackageMaterial, Protection, ShippingMode } from '../packaging/packaging.enums';
import { ShippingStrategyRegistry } from '../packaging/shipping-strategy.registry';
import { PricingPipeline } from '../pricing/pricing.pipeline';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

const duck: Duck = {
  id: 7,
  color: Color.Green,
  size: Size.Medium,
  price: 15,
  quantity: 500,
  deleted: false,
};

const order: CreateOrderDto = {
  color: Color.Green,
  size: Size.Medium,
  quantity: 150,
  country: 'USA',
  shippingMode: ShippingMode.AIR,
};

describe('OrdersService', () => {
  const findCheapestMatch = jest.fn();
  const decrementStock = jest.fn();
  const ducks = { findCheapestMatch, decrementStock } as unknown as DucksService;
  const pipeline = new PricingPipeline();
  const service = new OrdersService(ducks, new ShippingStrategyRegistry(), pipeline);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
    findCheapestMatch.mockResolvedValue(duck);
    decrementStock.mockResolvedValue(undefined);
  });

  it('prices the worked example and decrements the chosen duck', async () => {
    const result = await service.place(order);

    expect(findCheapestMatch).toHaveBeenCalledWith(Color.Green, Size.Medium, 150);
    expect(decrementStock).toHaveBeenCalledWith(7, 150);
    expect(result).toEqual({
      duckId: 7,
      packageType: PackageMaterial.CARDBOARD,
      protection: [Protection.POLYSTYRENE_BALLS],
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

  it('prices before touching stock', async () => {
    const run = jest.spyOn(pipeline, 'run');
    await service.place(order);
    expect(run.mock.invocationCallOrder[0]).toBeLessThan(
      decrementStock.mock.invocationCallOrder[0],
    );
  });

  it('returns the 409 from decrementStock as is', async () => {
    const conflict = new ConflictException('Duck 7 no longer has 150 in stock');
    decrementStock.mockRejectedValue(conflict);
    await expect(service.place(order)).rejects.toBe(conflict);
  });

  it('does not touch stock when no duck matches', async () => {
    findCheapestMatch.mockRejectedValue(new NotFoundException());
    await expect(service.place(order)).rejects.toThrow(NotFoundException);
    expect(decrementStock).not.toHaveBeenCalled();
  });
});
