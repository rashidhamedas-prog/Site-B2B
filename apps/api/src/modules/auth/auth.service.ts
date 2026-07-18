import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

/** True when the DB rejected an insert because the customer `code` already exists. */
function isDuplicateCodeError(err: unknown): boolean {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  const code = e.code ?? e.driverError?.code;
  const detail = e.detail ?? e.driverError?.detail ?? '';
  return code === '23505' && /\(code\)/i.test(detail);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('این شماره قبلاً ثبت شده است');

    // A customer row (even soft-deleted) keeps the unique phone/code constraints,
    // so guard against an already-registered phone before inserting.
    const existingCustomer = await this.customerRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });
    if (existingCustomer && !existingCustomer.deletedAt) {
      throw new ConflictException('این شماره قبلاً ثبت شده است');
    }

    const customerData = {
      businessName: dto.businessName,
      ownerName: dto.ownerName,
      phone: dto.phone,
      email: dto.email,
      province: dto.province,
      city: dto.city,
      businessType: dto.businessType ?? 'RETAIL',
      notes: dto.notes,
      status: 'PENDING',
      segment: 'C',
    };

    let savedCustomer: CustomerEntity;
    if (existingCustomer?.deletedAt) {
      // Reactivate a previously soft-deleted customer with the same phone,
      // reusing its code to avoid violating unique constraints.
      await this.customerRepo.restore(existingCustomer.id);
      await this.customerRepo.update(existingCustomer.id, customerData);
      savedCustomer = await this.customerRepo.findOneOrFail({ where: { id: existingCustomer.id } });
    } else {
      savedCustomer = await this.createCustomerWithUniqueCode(customerData);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      phone: dto.phone,
      email: dto.email,
      passwordHash,
      role: 'CUSTOMER',
      customerId: savedCustomer.id,
    });
    await this.userRepo.save(user);
    return { message: 'ثبت‌نام با موفقیت انجام شد. منتظر تأیید ادمین باشید.' };
  }

  /**
   * Generates the next sequential customer code (TRN-#####) based on the highest
   * existing code — including soft-deleted rows, whose unique code constraint is
   * still enforced — and retries on the rare concurrent-insert collision.
   */
  private async createCustomerWithUniqueCode(
    data: Partial<CustomerEntity>,
  ): Promise<CustomerEntity> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCustomerCode();
      try {
        return await this.customerRepo.save(this.customerRepo.create({ ...data, code }));
      } catch (err) {
        if (isDuplicateCodeError(err) && attempt < 4) continue;
        throw err;
      }
    }
    throw new ConflictException('امکان ایجاد کد مشتری نبود، دوباره تلاش کنید');
  }

  private async nextCustomerCode(): Promise<string> {
    const rows = await this.customerRepo
      .createQueryBuilder('c')
      .withDeleted()
      .select('c.code', 'code')
      .where("c.code ~ '^TRN-[0-9]+$'")
      .getRawMany<{ code: string }>();
    const max = rows.reduce((m, r) => {
      const n = parseInt(r.code.slice(4), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `TRN-${String(max + 1).padStart(5, '0')}`;
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { phone: dto.phone } });
    if (!user || !user.isActive) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const token = this.jwtService.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { accessToken: token, role: user.role };
  }

  async findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  async getMyProfile(user: { sub: string; role: string; phone: string }) {
    const u = await this.userRepo.findOne({ where: { id: user.sub } });
    if (!u) return null;
    if (u.customerId) {
      const customer = await this.customerRepo.findOne({ where: { id: u.customerId } });
      if (customer) {
        return {
          userId: u.id,
          phone: u.phone,
          role: u.role,
          businessName: customer.businessName,
          ownerName: customer.ownerName,
          segment: customer.segment,
          customerCode: customer.code,
          creditLimit: customer.creditLimit ?? 0,
          totalSpent: 0,
          lastLoginAt: u.lastLoginAt,
        };
      }
    }
    return { userId: u.id, phone: u.phone, role: u.role, lastLoginAt: u.lastLoginAt };
  }

  async updateMyProfile(userId: string, data: { ownerName?: string; email?: string }) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    if (data.email) await this.userRepo.update(userId, { email: data.email });
    if (u.customerId && data.ownerName) {
      await this.customerRepo.update(u.customerId, { ownerName: data.ownerName });
    }
    return { message: 'پروفایل بروزرسانی شد' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) throw new UnauthorizedException();
    const valid = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!valid) throw new BadRequestException('رمز عبور فعلی اشتباه است');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.update(userId, { passwordHash });
    return { message: 'رمز عبور با موفقیت تغییر یافت' };
  }
}
