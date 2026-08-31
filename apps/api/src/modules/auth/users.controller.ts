import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { AdminOnly } from './decorators/admin-only.decorator';
import { UsersService } from './users.service';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { UpdateStaffUserDto } from './dto/update-staff-user.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';

type Authed = Express.Request & { user: { sub: string; role: string } };

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@AdminOnly()
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'لیست کاربران سیستم (نه مشتریان)' })
  findAll(
    @Query('q') q?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.users.findAll(q, active);
  }

  @Post()
  @ApiOperation({ summary: 'افزودن کاربر سیستم' })
  create(@Body() dto: CreateStaffUserDto, @Request() req: Authed) {
    return this.users.create(dto, req.user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'ویرایش نقش / وضعیت کاربر سیستم' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffUserDto,
    @Request() req: Authed,
  ) {
    return this.users.update(id, dto, req.user);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'بازنشانی رمز عبور توسط مدیر کل' })
  resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetStaffPasswordDto,
    @Request() req: Authed,
  ) {
    return this.users.resetPassword(id, dto.password, req.user);
  }
}
