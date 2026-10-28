import { IsIn, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const SMS_MESSAGE_CLASSES = ['OTP', 'TRANSACTIONAL', 'PROMO'] as const;
export const SMS_CAMPAIGN_CLASSES = ['TRANSACTIONAL', 'PROMO'] as const;

export class SmsSendDto {
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  to: string;

  @IsIn([...SMS_MESSAGE_CLASSES])
  messageClass: 'OTP' | 'TRANSACTIONAL' | 'PROMO';

  @IsOptional()
  @IsString()
  @MaxLength(700)
  body?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  vars?: Record<string, string>;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  salesPartnerId?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class SmsCreateCampaignDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsIn([...SMS_CAMPAIGN_CLASSES])
  messageClass: 'TRANSACTIONAL' | 'PROMO';

  @IsString()
  @MinLength(1)
  @MaxLength(700)
  body: string;

  @IsOptional()
  @IsUUID()
  listId?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsObject()
  varFallbacks?: Record<string, string>;

  @IsOptional()
  @IsUUID()
  segmentId?: string;

  @IsOptional()
  @IsObject()
  audienceSpec?: { sources?: string[]; rules?: unknown[] };
}

export class SmsConfirmDto {
  @IsString()
  @MinLength(16)
  token: string;

  @IsOptional()
  typedCount?: number | string;

  @IsString()
  @MinLength(6)
  @MaxLength(8)
  otp: string;
}

export class SmsApproveDto {
  @IsOptional()
  @IsString()
  token?: string;

  @IsOptional()
  reject?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SmsTemplateDto {
  @IsString()
  key: string;

  @IsString()
  name: string;

  @IsIn([...SMS_MESSAGE_CLASSES])
  messageClass: 'OTP' | 'TRANSACTIONAL' | 'PROMO';

  @IsString()
  body: string;

  @IsOptional()
  variables?: string[];

  @IsOptional()
  @IsString()
  providerTemplateId?: string;

  @IsOptional()
  isActive?: boolean;
}
