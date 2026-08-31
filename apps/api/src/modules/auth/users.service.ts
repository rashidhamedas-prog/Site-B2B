import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './entities/user.entity';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { STAFF_ROLES, isStaffRole } from './staff-access';
import { staffMutationError } from './users.policy';
import { normalizePhone } from './phone.util';

export type StaffActor = { sub: string; role: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private publicUser(u: UserEntity) {
    return {
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role,
      blogRole: u.blogRole,
      isActive: u.isActive,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
    };
  }

  private assertAdmin(actor: StaffActor) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException('فقط مدیر کل می‌تواند کاربران سیستم را مدیریت کند');
    }
  }

  private async remainingActiveAdmins(excludeId: string): Promise<number> {
    return this.userRepo.count({
      where: { role: 'ADMIN', isActive: true, id: Not(excludeId) },
    });
  }

  async findAll(q?: string, isActive?: boolean) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.role IN (:...roles)', { roles: [...STAFF_ROLES] })
      .orderBy('u.createdAt', 'DESC')
      .take(100);
    if (q?.trim()) {
      qb.andWhere('(u.phone ILIKE :q OR COALESCE(u.email, \'\') ILIKE :q)', {
        q: `%${q.trim()}%`,
      });
    }
    if (typeof isActive === 'boolean') {
      qb.andWhere('u.isActive = :isActive', { isActive });
    }
    const users = await qb.getMany();
    return { data: users.map((u) => this.publicUser(u)) };
  }

  async create(dto: CreateStaffUserDto, actor: StaffActor) {
    this.assertAdmin(actor);
    const phone = normalizePhone(dto.phone);
    const role = dto.role && isStaffRole(dto.role) ? dto.role : 'ADMIN';
    const existing = await this.userRepo.findOne({ where: { phone } });
    if (existing) throw new ConflictException('این شماره قبلاً ثبت شده است');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      phone,
      email: dto.email,
      passwordHash,
      role,
      blogRole: dto.blogRole ?? null,
      isActive: true,
    });
    const saved = await this.userRepo.save(user);
    return this.publicUser(saved);
  }

  async update(id: string, dto: UpdateStaffUserDto, actor: StaffActor) {
    this.assertAdmin(actor);
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || !isStaffRole(user.role)) throw new NotFoundException('کاربر یافت نشد');

    const remaining = await this.remainingActiveAdmins(user.id);
    const error = staffMutationError({
      actorId: actor.sub,
      actorRole: actor.role,
      targetId: user.id,
      targetRole: user.role,
      nextRole: dto.role,
      nextIsActive: dto.isActive,
      remainingActiveAdmins: remaining,
    });
    if (error) throw new BadRequestException(error);

    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.blogRole !== undefined) user.blogRole = dto.blogRole;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    const saved = await this.userRepo.save(user);
    return this.publicUser(saved);
  }

  async resetPassword(id: string, password: string, actor: StaffActor) {
    this.assertAdmin(actor);
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user || !isStaffRole(user.role)) throw new NotFoundException('کاربر یافت نشد');
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.userRepo.save(user);
    return { id: user.id, reset: true };
  }

}
