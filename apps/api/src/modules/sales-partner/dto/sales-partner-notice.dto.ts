import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class PublishSalesPartnerNoticeDto {
  @ApiProperty()
  @IsString({ message: 'عنوان اطلاعیه را بنویسید' })
  @MinLength(1, { message: 'عنوان اطلاعیه را بنویسید' })
  @MaxLength(400, { message: 'عنوان اطلاعیه بلند است' })
  title: string;

  @ApiProperty()
  @IsString({ message: 'متن اطلاعیه را بنویسید' })
  @MinLength(1, { message: 'متن اطلاعیه را بنویسید' })
  @MaxLength(4000, { message: 'متن اطلاعیه بلند است' })
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(800)
  linkUrl?: string;

  @ApiProperty({ enum: ['info', 'important', 'urgent'] })
  @IsIn(['info', 'important', 'urgent'], { message: 'اهمیت اطلاعیه نامعتبر است' })
  tone: 'info' | 'important' | 'urgent';

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((row: PublishSalesPartnerNoticeDto) => Boolean(row.expiresAt))
  @IsISO8601({}, { message: 'تاریخ پایان نامعتبر است' })
  expiresAt?: string;
}
