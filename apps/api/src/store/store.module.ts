import { Module } from '@nestjs/common';
import { DucksModule } from '../ducks/ducks.module';
import { OrdersController } from './orders/orders.controller';
import { OrdersService } from './orders/orders.service';
import { ShippingStrategyRegistry } from './packaging/shipping-strategy.registry';
import { PricingPipeline } from './pricing/pricing.pipeline';
import { StoreDucksController } from './store-ducks.controller';

@Module({
  imports: [DucksModule],
  controllers: [StoreDucksController, OrdersController],
  providers: [
    OrdersService,
    // Plain classes with default constructor arguments, so they are built here rather
    // than by Nest's injector. Tests can swap them via overrideProvider.
    { provide: ShippingStrategyRegistry, useFactory: () => new ShippingStrategyRegistry() },
    { provide: PricingPipeline, useFactory: () => new PricingPipeline() },
  ],
})
export class StoreModule {}
