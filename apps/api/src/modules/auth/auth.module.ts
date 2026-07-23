import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { UsersController } from './users.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RolesGuard } from './guards/roles.guard';
import { UserEntity } from './entities/user.entity';
import { CustomerEntity } from '../customer/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, CustomerEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'taranom-secret-change-in-prod'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES', '7d') },
      }),
    }),
    // Do NOT import NotificationModule here — it already imports AuthModule (circular).
    // NotificationModule is @Global in AppModule, so NotificationService injects fine.
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService, JwtModule, RolesGuard],
})
export class AuthModule {}
