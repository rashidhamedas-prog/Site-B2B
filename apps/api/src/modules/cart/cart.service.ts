import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartSignalEntity } from './cart-signal.entity';
import { isIranMobile, normalizeIranMobile } from '../notification/sms-ops';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartSignalEntity)
    private readonly repo: Repository<CartSignalEntity>,
  ) {}

  async heartbeat(input: {
    channel?: string;
    sessionId?: string;
    phone?: string;
    items?: Array<{ productId?: string; name?: string; quantity?: number }>;
  }) {
    const channel = String(input.channel || '').toUpperCase() === 'RETAIL' ? 'RETAIL' : 'WHOLESALE';
    const sessionId = String(input.sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (sessionId.length < 8) return { ok: false };
    const items = Array.isArray(input.items) ? input.items.slice(0, 20).map((it) => ({
      productId: String(it?.productId || '').slice(0, 80),
      name: String(it?.name || '').slice(0, 80),
      quantity: Math.max(0, Math.min(999, Number(it?.quantity) || 0)),
    })) : [];
    if (items.length === 0) {
      if (sessionId) {
        await this.repo.delete({ channel, sessionId });
      }
      return { ok: true, cleared: true };
    }

    const phone = isIranMobile(input.phone) ? normalizeIranMobile(input.phone) : '';
    let row = await this.repo.findOne({ where: { channel, sessionId } });
    if (!row) {
      row = this.repo.create({
        channel,
        sessionId,
        phone,
        items,
        lastItemAt: new Date(),
        reminderSentAt: null,
      });
    } else {
      row.items = items;
      row.lastItemAt = new Date();
      row.reminderSentAt = null;
      if (phone) row.phone = phone;
    }
    await this.repo.save(row);
    return { ok: true };
  }
}
