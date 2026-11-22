import { Body, Controller, Post } from '@nestjs/common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResult, OrdersService } from './orders.service';

@Controller('store/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  /** 201 with the chosen duck, packaging and price breakdown. 404 or 409 from stock checks. */
  @Post()
  place(@Body() dto: CreateOrderDto): Promise<OrderResult> {
    return this.orders.place(dto);
  }
}
