import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import {
  SALES_PARTNER_NOTICE_BODY_MAX,
  SALES_PARTNER_NOTICE_BODY_TOO_LONG,
  SALES_PARTNER_NOTICE_LINK_LABEL_MAX,
  SALES_PARTNER_NOTICE_LINK_LABEL_TOO_LONG,
  SALES_PARTNER_NOTICE_LINK_URL_MAX,
  SALES_PARTNER_NOTICE_LINK_URL_TOO_LONG,
  SALES_PARTNER_NOTICE_TITLE_MAX,
  SALES_PARTNER_NOTICE_TITLE_TOO_LONG,
} from '../sales-partner-notice-policy';

export class PublishSalesPartnerNoticeDto {
  @ApiProperty({ maxLength: SALES_PARTNER_NOTICE_TITLE_MAX })
  @IsString({ message: 'عنوان اطلاعیه را بنویسید' })
  @MinLength(1, { message: 'عنوان اطلاعیه را بنویسید' })
  @MaxLength(SALES_PARTNER_NOTICE_TITLE_MAX, { message: SALES_PARTNER_NOTICE_TITLE_TOO_LONG })
  title: string;

  @ApiProperty({ maxLength: SALES_PARTNER_NOTICE_BODY_MAX })
  @IsString({ message: 'متن اطلاعیه را بنویسید' })
  @MinLength(1, { message: 'متن اطلاعیه را بنویسید' })
  @MaxLength(SALES_PARTNER_NOTICE_BODY_MAX, { message: SALES_PARTNER_NOTICE_BODY_TOO_LONG })
  body: string;

  @ApiPropertyOptional({ maxLength: SALES_PARTNER_NOTICE_LINK_LABEL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(SALES_PARTNER_NOTICE_LINK_LABEL_MAX, { message: SALES_PARTNER_NOTICE_LINK_LABEL_TOO_LONG })
  linkLabel?: string;

  @ApiPropertyOptional({ maxLength: SALES_PARTNER_NOTICE_LINK_URL_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(SALES_PARTNER_NOTICE_LINK_URL_MAX, { message: SALES_PARTNER_NOTICE_LINK_URL_TOO_LONG })
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
