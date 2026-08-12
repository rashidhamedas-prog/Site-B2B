import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentProviderEntity } from './entities/payment-provider.entity';
import { DisabledPaymentAdapter } from './adapters/disabled.adapter';

@Injectable()
export class PaymentProviderRegistryService {
  constructor(
    @InjectRepository(PaymentProviderEntity)
    private readonly repo: Repository<PaymentProviderEntity>,
  ) {}

  async listAll(): Promise<PaymentProviderEntity[]> {
    return this.repo.find({ order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  /** Server-authoritative checkout eligibility — never trust client. */
  async listEligible(channel: 'WHOLESALE' | 'RETAIL'): Promise<PaymentProviderEntity[]> {
    const all = await this.listAll();
    return all.filter((p) => {
      if (!p.enabled || p.maintenanceMode) return false;
      if (p.contractStatus !== 'APPROVED') return false;
      if (p.healthStatus === 'DOWN') return false;
      if (p.channel !== 'BOTH' && p.channel !== channel) return false;
      if (!(p.capabilities?.pay || p.capabilities?.bnpl)) return false;
      return true;
    });
  }

  async getByCode(code: string): Promise<PaymentProviderEntity> {
    const row = await this.repo.findOne({ where: { code: code.toUpperCase() } });
    if (!row) throw new NotFoundException('درگاه یافت نشد');
    return row;
  }

  /** Resolve runtime adapter — non-approved providers always Disabled. */
  resolveAdapter(provider: PaymentProviderEntity) {
    if (
      !provider.enabled ||
      provider.contractStatus !== 'APPROVED' ||
      provider.maintenanceMode
    ) {
      return new DisabledPaymentAdapter(provider.code);
    }
    return null; // caller uses ZarinPalAdapter for ZARINPAL
  }

  async adminUpdate(
    code: string,
    patch: Partial<Pick<
      PaymentProviderEntity,
      | 'enabled'
      | 'channel'
      | 'sortOrder'
      | 'minAmountIrr'
      | 'maxAmountIrr'
      | 'maintenanceMode'
      | 'displayName'
      | 'logoUrl'
      | 'healthStatus'
      | 'contractStatus'
    >>,
  ): Promise<PaymentProviderEntity> {
    const row = await this.getByCode(code);
    // Never allow enabling BNPL without APPROVED contract
    if (patch.enabled === true && row.type === 'BNPL' && (patch.contractStatus || row.contractStatus) !== 'APPROVED') {
      throw new BadRequestException('فعال‌سازی BNPL بدون قرارداد APPROVED مجاز نیست');
    }
    if (patch.contractStatus === 'APPROVED' && row.type === 'BNPL' && !row.configReference) {
      throw new BadRequestException('بدون مرجع credential رسمی نمی‌توان قرارداد را APPROVED کرد');
    }
    Object.assign(row, patch);
    // Never persist secrets via this API
    return this.repo.save(row);
  }
}
