import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UserEntity } from './entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { OrderEntity } from '../order/entities/order.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { NotificationService } from '../notification/notification.service';
import { OtpService } from '../redis/redis.module';
import { allowDevOtpExpose, normalizePhone } from './phone.util';
import { isStaffRole, roleAfterCustomerLink, staffPhoneConflictMessage } from './staff-access';

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

function isDuplicatePhoneError(err: unknown): boolean {
  const e = (err ?? {}) as {
    code?: string;
    detail?: string;
    driverError?: { code?: string; detail?: string };
  };
  const code = e.code ?? e.driverError?.code;
  const detail = e.detail ?? e.driverError?.detail ?? '';
  return code === '23505' && /\(phone\)/i.test(detail);
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(OrderEntity)
    private readonly orderRepo: Repository<OrderEntity>,
    private readonly jwtService: JwtService,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly otpService: OtpService,
    @Optional() private readonly notifications?: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });
    const existingCustomer = await this.customerRepo.findOne({
      where: { phone: dto.phone },
      withDeleted: true,
    });

    if (existingCustomer && !existingCustomer.deletedAt) {
      throw new ConflictException('این شماره قبلاً ثبت شده است');
    }

    if (existingUser && !existingUser.deletedAt) {
      if (isStaffRole(existingUser.role)) {
        throw new ConflictException('این شماره متعلق به کاربر سیستم است و برای ثبت‌نام عمده قابل استفاده نیست');
      }
      const linkedCustomer = existingUser.customerId
        ? await this.customerRepo.findOne({
            where: { id: existingUser.customerId },
            withDeleted: true,
          })
        : null;
      if (linkedCustomer && !linkedCustomer.deletedAt) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const customerData: Partial<CustomerEntity> = {
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

    try {
      const result = await this.dataSource.transaction(async (manager) => {
        const customerRepo = manager.getRepository(CustomerEntity);
        const userRepo = manager.getRepository(UserEntity);

        let savedCustomer: CustomerEntity;
        if (existingCustomer?.deletedAt) {
          // Reactivate a previously soft-deleted customer with the same phone,
          // reusing its code to avoid violating unique constraints.
          await customerRepo.restore(existingCustomer.id);
          await customerRepo.update(existingCustomer.id, customerData);
          savedCustomer = await customerRepo.findOneOrFail({ where: { id: existingCustomer.id } });
        } else {
          savedCustomer = await this.createCustomerWithUniqueCode(customerData, manager);
        }

        if (existingUser) {
          if (existingUser.deletedAt) {
            await userRepo.restore(existingUser.id);
          }
          await userRepo.update(existingUser.id, {
            email: dto.email,
            passwordHash,
            customerId: savedCustomer.id,
            isActive: false,
            role: roleAfterCustomerLink(existingUser.role),
          });
        } else {
          const user = userRepo.create({
            phone: dto.phone,
            email: dto.email,
            passwordHash,
            role: 'CUSTOMER',
            customerId: savedCustomer.id,
            isActive: false,
          });
          await userRepo.save(user);
        }

        return {
          message: 'ثبت‌نام با موفقیت انجام شد. منتظر تأیید ادمین باشید.',
          customer: savedCustomer,
        };
      });

      // Fire-and-forget admin alert for new wholesale registration.
      if (this.notifications && result.customer) {
        const label =
          result.customer.businessName || result.customer.ownerName || result.customer.phone;
        this.notifications
          .wholesaleRegistrationAdmin(label, result.customer.phone)
          .catch(() => undefined);
      }

      return { message: result.message };
    } catch (err) {
      if (isDuplicatePhoneError(err) || isDuplicateCodeError(err)) {
        throw new ConflictException('این شماره قبلاً ثبت شده است');
      }
      throw err;
    }
  }

  /**
   * Generates the next sequential customer code (TRN-#####) based on the highest
   * existing code — including soft-deleted rows, whose unique code constraint is
   * still enforced — and retries on the rare concurrent-insert collision.
   */
  private async createCustomerWithUniqueCode(
    data: Partial<CustomerEntity>,
    manager?: EntityManager,
  ): Promise<CustomerEntity> {
    const customerRepo = manager
      ? manager.getRepository(CustomerEntity)
      : this.customerRepo;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCustomerCode(customerRepo);
      try {
        return await customerRepo.save(customerRepo.create({ ...data, code }));
      } catch (err) {
        if (isDuplicateCodeError(err) && attempt < 4) continue;
        throw err;
      }
    }
    throw new ConflictException('امکان ایجاد کد مشتری نبود، دوباره تلاش کنید');
  }

  private async nextCustomerCode(
    repo: Repository<CustomerEntity> = this.customerRepo,
  ): Promise<string> {
    const rows = await repo
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
    const phone = normalizePhone(dto.phone);
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');

    if (user.role === 'CUSTOMER') {
      const customer = user.customerId
        ? await this.customerRepo.findOne({ where: { id: user.customerId } })
        : null;

      if (!user.isActive || !customer || customer.status !== 'ACTIVE') {
        if (customer?.status === 'PENDING') {
          throw new UnauthorizedException(
            'حساب شما هنوز تأیید نشده است. منتظر تأیید ادمین باشید.',
          );
        }
        throw new UnauthorizedException(
          'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.',
        );
      }
    } else if (!user.isActive) {
      throw new UnauthorizedException('شماره یا رمز عبور اشتباه است');
    }

    user.lastLoginAt = new Date();
    await this.userRepo.save(user);

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
      customerId: user.customerId ?? undefined,
    });
    return {
      accessToken: token,
      role: user.role,
      customerId: user.customerId ?? undefined,
    };
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
        const spentRow = await this.orderRepo
          .createQueryBuilder('o')
          .select('SUM(o.total)', 'sum')
          .where('o.customerId = :cid', { cid: customer.id })
          .andWhere("o.status NOT IN ('PENDING_REVIEW', 'CANCELLED', 'DELETED')")
          .getRawOne();
        return {
          userId: u.id,
          phone: u.phone,
          email: u.email,
          role: u.role,
          businessName: customer.businessName,
          ownerName: customer.ownerName,
          segment: customer.segment,
          customerCode: customer.code,
          creditLimit: customer.creditLimit ?? 0,
          balance: Number(customer.balance) || 0,
          customerId: customer.id,
          totalSpent: Number(spentRow?.sum) || 0,
          lastLoginAt: u.lastLoginAt,
        };
      }
    }
    return {
      userId: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      lastLoginAt: u.lastLoginAt,
    };
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

  /** Sync user.isActive when admin changes customer status. */
  async syncUserActiveByCustomerId(customerId: string, status: string) {
    const user = await this.userRepo.findOne({ where: { customerId } });
    if (!user) return;
    await this.userRepo.update(user.id, { isActive: status === 'ACTIVE' });
  }

  /** Soft-delete user account when customer is removed. */
  async deactivateUserByCustomerId(customerId: string) {
    const user = await this.userRepo.findOne({ where: { customerId } });
    if (!user) return;
    await this.userRepo.update(user.id, { isActive: false });
    await this.userRepo.softDelete(user.id);
  }

  private allowDevOtpExpose(): boolean {
    return allowDevOtpExpose(
      String(this.config.get('NODE_ENV') ?? ''),
      String(this.config.get('OTP_DEV_EXPOSE_CODE', 'false')),
    );
  }

  /** Retail (B2C) OTP — hashed store; production never returns the code. */
  async requestRetailOtp(rawPhone: string, name?: string) {
    const phone = normalizePhone(rawPhone);
    if (!/^09\d{9}$/.test(phone)) {
      throw new BadRequestException('شماره موبایل معتبر نیست');
    }

    const isProd = this.config.get('NODE_ENV') === 'production';

    const existing = await this.userRepo.findOne({ where: { phone } });
    const staffBlock = staffPhoneConflictMessage(existing?.role);
    if (staffBlock) {
      throw new BadRequestException(staffBlock);
    }

    let code: string;
    try {
      ({ code } = await this.otpService.issue(phone, name));
    } catch (err: any) {
      if (err?.message === 'COOLDOWN') {
        throw new BadRequestException('لطفاً کمی صبر کنید و دوباره درخواست کد دهید');
      }
      throw new ServiceUnavailableException('سرویس ارسال کد موقتاً در دسترس نیست');
    }

    const sent = this.notifications
      ? await this.notifications.sendOtp(phone, code)
      : false;

    if (!sent && isProd) {
      await this.otpService.clear(phone);
      throw new ServiceUnavailableException('ارسال پیامک ناموفق بود. بعداً تلاش کنید.');
    }

    const res: { message: string; phone: string; sent: boolean; devCode?: string } = {
      message: sent ? 'کد تایید ارسال شد' : 'کد تایید آماده است (حالت توسعه)',
      phone,
      sent,
    };
    if (!sent && this.allowDevOtpExpose()) {
      res.devCode = code;
    }
    return res;
  }

  /** Retail (B2C) OTP — verify and issue JWT; never auto-approve inactive B2B. */
  async verifyRetailOtp(rawPhone: string, code: string, name?: string) {
    const phone = normalizePhone(rawPhone);

    let otpName: string | undefined;
    try {
      const verified = await this.otpService.verify(phone, code);
      otpName = verified.name;
    } catch (err: any) {
      const msg = err?.message;
      if (msg === 'MAX_ATTEMPTS') {
        throw new UnauthorizedException('تعداد تلاش بیش از حد. دوباره کد بگیرید.');
      }
      if (msg === 'INVALID') {
        throw new UnauthorizedException('کد تایید نادرست است');
      }
      throw new UnauthorizedException('کد منقضی شده یا یافت نشد. دوباره درخواست کنید.');
    }

    const displayName = (name?.trim() || otpName || 'خریدار ترنم').slice(0, 80);

    let user = await this.userRepo.findOne({ where: { phone }, withDeleted: true });
    const staffBlock = staffPhoneConflictMessage(user && !user.deletedAt ? user.role : null);
    if (staffBlock) {
      throw new BadRequestException(staffBlock);
    }
    let customer: CustomerEntity | null = null;

    if (user?.customerId) {
      customer = await this.customerRepo.findOne({ where: { id: user.customerId }, withDeleted: true });
    }
    if (!customer) {
      customer = await this.customerRepo.findOne({ where: { phone }, withDeleted: true });
    }

    await this.dataSource.transaction(async (manager) => {
      const customerRepo = manager.getRepository(CustomerEntity);
      const userRepo = manager.getRepository(UserEntity);

      if (customer?.deletedAt) {
        await customerRepo.restore(customer.id);
        customer = await customerRepo.findOneOrFail({ where: { id: customer.id } });
      }

      if (!customer) {
        customer = await this.createCustomerWithUniqueCode(
          {
            businessName: displayName,
            ownerName: displayName,
            phone,
            province: 'تهران',
            city: 'تهران',
            type: 'B2C',
            businessType: 'RETAIL',
            status: 'ACTIVE',
            segment: 'C',
            isActive: true,
            notes: 'مصرف‌کننده فروشگاه آنلاین (.ir)',
          },
          manager,
        );
      } else if (customer.type === 'B2C' || (customer.notes || '').includes('فروشگاه آنلاین')) {
        if (customer.status === 'BLOCKED' || customer.status === 'SUSPENDED') {
          throw new UnauthorizedException('حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.');
        }
        await customerRepo.update(customer.id, {
          status: 'ACTIVE',
          isActive: true,
          ownerName: customer.ownerName || displayName,
        });
        customer.status = 'ACTIVE';
      } else if (customer.status !== 'ACTIVE') {
        throw new UnauthorizedException(
          customer.status === 'PENDING'
            ? 'حساب عمده شما هنوز تأیید نشده است. منتظر تأیید ادمین باشید.'
            : 'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.',
        );
      }

      const otpPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
      const allowLogin = customer!.status === 'ACTIVE';

      if (user) {
        if (user.deletedAt) await userRepo.restore(user.id);
        await userRepo.update(user.id, {
          customerId: customer!.id,
          isActive: allowLogin,
          role: roleAfterCustomerLink(user.role),
          lastLoginAt: allowLogin ? new Date() : user.lastLoginAt,
        });
        user = await userRepo.findOneOrFail({ where: { id: user.id } });
      } else {
        user = await userRepo.save(
          userRepo.create({
            phone,
            passwordHash: otpPasswordHash,
            role: 'CUSTOMER',
            customerId: customer!.id,
            isActive: allowLogin,
            lastLoginAt: allowLogin ? new Date() : undefined,
          }),
        );
      }
    });

    user = await this.userRepo.findOneOrFail({ where: { phone } });
    if (!user.customerId) {
      throw new BadRequestException('حساب مشتری ایجاد نشد');
    }

    const customerFinal = await this.customerRepo.findOne({ where: { id: user.customerId } });
    if (!customerFinal || customerFinal.status !== 'ACTIVE' || !user.isActive) {
      throw new UnauthorizedException(
        customerFinal?.status === 'PENDING'
          ? 'حساب شما هنوز تأیید نشده است. منتظر تأیید ادمین باشید.'
          : 'حساب شما غیرفعال است. با پشتیبانی تماس بگیرید.',
      );
    }

    const token = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      role: user.role,
      customerId: user.customerId,
    });
    return {
      accessToken: token,
      role: user.role,
      customerId: user.customerId,
      channel: 'RETAIL',
    };
  }
}
