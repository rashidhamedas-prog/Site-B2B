import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';

@ApiTags('cart')
@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Post('heartbeat')
  heartbeat(
    @Body()
    body: {
      channel?: string;
      sessionId?: string;
      phone?: string;
      items?: Array<{ productId?: string; name?: string; quantity?: number }>;
    },
  ) {
    return this.cart.heartbeat(body ?? {});
  }
}
