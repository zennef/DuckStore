import { Injectable } from '@nestjs/common';
import { DucksService } from '../../ducks/ducks.service';
import { LineItem } from '../line-item';
import { PackageFactory } from '../packaging/package.factory';
import { PackageMaterial, Protection } from '../packaging/packaging.enums';
import { ShippingStrategyRegistry } from '../packaging/shipping-strategy.registry';
import { toCents } from '../pricing/money';
import { PricingPipeline } from '../pricing/pricing.pipeline';
import { CreateOrderDto } from './dto/create-order.dto';

/** A line item as returned by the API: the amount in dollars instead of cents. */
export interface OrderLineItem {
  label: string;
  amount: number;
  type: LineItem['type'];
}

export interface OrderResult {
  duckId: number;
  packageType: PackageMaterial;
  protection: Protection[];
  lineItems: OrderLineItem[];
  total: number;
}

/** Cents are exact integers, so dividing by 100 gives the closest double to the dollar amount. */
const toDollars = (cents: number): number => cents / 100;

@Injectable()
export class OrdersService {
  constructor(
    private readonly ducks: DucksService,
    private readonly shipping: ShippingStrategyRegistry,
    private readonly pricing: PricingPipeline,
  ) {}

  /**
   * Picks the duck, works out packaging and price, then takes the stock. Packaging and
   * pricing are pure, so they run before any write: if decrementStock loses a race and
   * throws 409, nothing else has happened and the 409 is returned as is.
   */
  async place(dto: CreateOrderDto): Promise<OrderResult> {
    const duck = await this.ducks.findCheapestMatch(dto.color, dto.size, dto.quantity);

    const material = PackageFactory.forSize(duck.size);
    const shipping = this.shipping.get(dto.shippingMode);
    const protection = shipping.getProtection(material);

    // Priced from the same duck record that is decremented below.
    const { lineItems, totalCents } = this.pricing.run({
      quantity: dto.quantity,
      unitPriceCents: toCents(duck.price),
      material,
      country: dto.country,
      shipping,
    });

    await this.ducks.decrementStock(duck.id, dto.quantity);

    return {
      duckId: duck.id,
      packageType: material,
      protection,
      lineItems: lineItems.map(({ label, amountCents, type }) => ({
        label,
        amount: toDollars(amountCents),
        type,
      })),
      total: toDollars(totalCents),
    };
  }
}
