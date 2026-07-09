import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserEntity } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  @Get()
  @ApiOperation({ summary: 'لیست کاربران ادمین' })
  async findAll(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    const users = await this.userRepo.find({ where: { role: 'ADMIN' }, take: limit, order: { createdAt: 'DESC' } });
    return { data: users.map((u) => ({ id: u.id, phone: u.phone, email: u.email, role: u.role, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) };
  }

  @Post()
  @ApiOperation({ summary: 'افزودن ادمین جدید' })
  async create(@Body() body: { phone: string; email?: string; password: string; role?: string }) {
    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = this.userRepo.create({
      phone: body.phone,
      email: body.email,
      passwordHash,
      role: body.role ?? 'ADMIN',
      isActive: true,
    });
    const saved = await this.userRepo.save(user);
    return { id: saved.id, phone: saved.phone, role: saved.role };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش کاربر' })
  async update(@Param('id') id: string, @Body() body: { isActive?: boolean; role?: string }) {
    await this.userRepo.update(id, body);
    const user = await this.userRepo.findOne({ where: { id } });
    return { id: user?.id, phone: user?.phone, role: user?.role, isActive: user?.isActive };
  }
}
