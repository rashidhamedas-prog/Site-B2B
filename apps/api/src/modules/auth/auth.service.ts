import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

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

    const count = await this.customerRepo.count();
    const code = `TRN-${String(count + 1).padStart(5, '0')}`;
    const customer = this.customerRepo.create({
      code,
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
    });
    const savedCustomer = await this.customerRepo.save(customer);

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
