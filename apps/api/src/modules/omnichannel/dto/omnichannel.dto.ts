import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OMNICHANNEL_CHANNELS,
  OMNICHANNEL_PROVIDERS,
  CONNECTION_STATUSES,
  OOS_POLICIES,
} from '../omnichannel.constants';

/** Env name only — never a token. Only provider-prefixed refs may be resolved. */
const SECRET_REF = /^(TELEGRAM|BALE|RUBIKA)_[A-Z0-9_]{1,80}$/;

export class CreateConnectionDto {
  @IsIn(OMNICHANNEL_PROVIDERS)
  provider: (typeof OMNICHANNEL_PROVIDERS)[number];

  @IsIn(OMNICHANNEL_CHANNELS)
  channel: (typeof OMNICHANNEL_CHANNELS)[number];

  @IsString()
  @MaxLength(120)
  name: string;

  @IsString()
  @Matches(SECRET_REF, { message: 'secretRef باید نام env باشد نه مقدار secret' })
  secretRef: string;
}

export class PatchConnectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(SECRET_REF, { message: 'secretRef باید نام env باشد نه مقدار secret' })
  secretRef?: string;

  @IsOptional()
  @IsIn(CONNECTION_STATUSES)
  status?: (typeof CONNECTION_STATUSES)[number];
}

export class PatchOmnichannelSettingsDto {
  @IsOptional()
  @IsIn(OOS_POLICIES)
  retailOosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsIn(OOS_POLICIES)
  wholesaleOosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class PatchDestinationDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isCanary?: boolean;
}

export class CreateDestinationDto {
  @IsUUID()
  connectionId: string;

  @IsString()
  @MaxLength(160)
  destinationKey: string;

  @IsString()
  @MaxLength(160)
  displayName: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}

export class CreateTemplateDto {
  @IsIn(OMNICHANNEL_PROVIDERS)
  provider: (typeof OMNICHANNEL_PROVIDERS)[number];

  @IsIn(OMNICHANNEL_CHANNELS)
  channel: (typeof OMNICHANNEL_CHANNELS)[number];

  @IsString()
  @MaxLength(80)
  eventType: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsString()
  @MaxLength(8000)
  body: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  version?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PatchTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PreviewDto {
  @IsUUID()
  @IsOptional()
  connectionId?: string;

  @IsIn(OMNICHANNEL_CHANNELS)
  channel: (typeof OMNICHANNEL_CHANNELS)[number];

  @IsString()
  @MaxLength(40)
  sourceType: string;

  @IsString()
  @MaxLength(80)
  sourceId: string;
}

export class CreatePublicationDto {
  @ValidateNested()
  @Type(() => PreviewDto)
  preview: PreviewDto;

  /** Default true — live canary requires an explicit false. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ActorReasonDto {
  @IsString()
  @MaxLength(240)
  reason: string;
}

export class PatchMediaAltDto {
  @IsString()
  @MaxLength(200)
  altText: string;
}
