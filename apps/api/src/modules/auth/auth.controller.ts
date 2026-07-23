import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'ثبت‌نام مشتری جدید' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ورود به حساب کاربری' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('retail/otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'درخواست کد OTP فروشگاه تکی' })
  requestRetailOtp(@Body() body: { phone: string; name?: string }) {
    return this.authService.requestRetailOtp(body.phone, body.name);
  }

  @Post('retail/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'تأیید OTP و ورود فروشگاه تکی' })
  verifyRetailOtp(@Body() body: { phone: string; code: string; name?: string }) {
    return this.authService.verifyRetailOtp(body.phone, body.code, body.name);
  }

  @Get('me/profile')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'پروفایل کاربر جاری' })
  getProfile(@Request() req: Express.Request & { user: { sub: string; role: string; phone: string } }) {
    return this.authService.getMyProfile(req.user);
  }

  @Patch('me/profile')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'ویرایش پروفایل کاربر' })
  updateProfile(
    @Request() req: Express.Request & { user: { sub: string; role: string; phone: string } },
    @Body() body: { ownerName?: string; email?: string },
  ) {
    return this.authService.updateMyProfile(req.user.sub, body);
  }

  @Patch('me/password')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'تغییر رمز عبور' })
  changePassword(
    @Request() req: Express.Request & { user: { sub: string; role: string; phone: string } },
    @Body() body: { current: string; password: string },
  ) {
    return this.authService.changePassword(req.user.sub, body.current, body.password);
  }
}
