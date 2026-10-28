import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { BULK_WITHDRAW_PUBLICATION_MAX } from '../bulk-publication-ids';
import {
  AUTO_DAILY_CAP_MAX,
  AUTO_DAILY_CAP_MIN,
  AUTO_MIN_GAP_MAX_SECONDS,
  AUTO_MIN_GAP_MIN_SECONDS,
  AUTO_PUBLISH_CANDIDATE_EVENTS,
  AUTO_PUBLISH_MODES,
  CONNECTION_STATUSES,
  OMNICHANNEL_CHANNELS,
  OMNICHANNEL_PROVIDERS,
  OOS_POLICIES,
  OUTBOX_RETENTION_MAX_DAYS,
  OUTBOX_RETENTION_MIN_DAYS,
  RETRY_SLA_MAX_SECONDS,
  RETRY_SLA_MIN_SECONDS,
  WITHDRAW_ACTIONS,
} from '../omnichannel.constants';

/** Env name only — never a token. Only provider-prefixed refs may be resolved. */
const SECRET_REF = /^(TELEGRAM|BALE|RUBIKA)_[A-Z0-9_]{1,80}$/;

/** Written GO from Hamed — required on Owner-tier when OMNICHANNEL_RBAC_ENABLED=true. */
export class GoRefDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  goRef?: string;
}

export class CreateConnectionDto extends GoRefDto {
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

/** Write-only. Never returned. Only accepted on PUT /omnichannel/secrets. */
export class PutSecretDto extends GoRefDto {
  @IsString()
  @Matches(SECRET_REF, { message: 'secretRef باید نام env باشد نه مقدار secret' })
  secretRef: string;

  @IsString()
  @MinLength(20, { message: 'توکن کوتاه‌تر از حد مجاز است' })
  @MaxLength(256, { message: 'توکن بلندتر از حد مجاز است' })
  @Matches(/^\S+$/, { message: 'توکن نباید فاصله داشته باشد' })
  token: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
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

export class PatchOmnichannelSettingsDto extends GoRefDto {
  /**
   * Primary scope for automation/OOS fields (required for those writes).
   */
  @IsOptional()
  @IsUUID('4')
  destinationId?: string;

  /**
   * Compat: when set with automation/OOS and destinationId omitted, routes to connection blob.
   * Prefer destinationId.
   */
  @IsOptional()
  @IsUUID('4')
  connectionId?: string;

  @IsOptional()
  @IsIn(OOS_POLICIES)
  retailOosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsIn(OOS_POLICIES)
  wholesaleOosPolicy?: (typeof OOS_POLICIES)[number];

  /** Single-connection OOS (preferred over retail/wholesale when connectionId is set). */
  @IsOptional()
  @IsIn(OOS_POLICIES)
  oosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AUTO_PUBLISH_CANDIDATE_EVENTS, { each: true })
  autoPublishEventTypes?: (typeof AUTO_PUBLISH_CANDIDATE_EVENTS)[number][];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(RETRY_SLA_MIN_SECONDS)
  @Max(RETRY_SLA_MAX_SECONDS)
  retrySlaSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(OUTBOX_RETENTION_MIN_DAYS)
  @Max(OUTBOX_RETENTION_MAX_DAYS)
  outboxRetentionDays?: number;

  /** Per-connection automation when connectionId is set. */
  @IsOptional()
  @IsIn(AUTO_PUBLISH_MODES)
  autoPublishMode?: (typeof AUTO_PUBLISH_MODES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_DAILY_CAP_MIN)
  @Max(AUTO_DAILY_CAP_MAX)
  autoDailyCap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_MIN_GAP_MIN_SECONDS)
  @Max(AUTO_MIN_GAP_MAX_SECONDS)
  autoMinGapSeconds?: number;

  /** Tehran hour 0..23; send null to clear the quiet window (IsOptional skips null). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietStartHour?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietEndHour?: number | null;

  @IsOptional()
  @IsIn(WITHDRAW_ACTIONS)
  withdrawAction?: (typeof WITHDRAW_ACTIONS)[number];

  /** Empty = all categories. Non-empty = auto-publish allowlist only. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  autoPublishCategoryIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

/** PATCH /omnichannel/destinations/:id/publish-settings — same fields as connection compat. */
export class PatchDestinationPublishSettingsDto extends GoRefDto {
  @IsOptional()
  @IsIn(OOS_POLICIES)
  oosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AUTO_PUBLISH_CANDIDATE_EVENTS, { each: true })
  autoPublishEventTypes?: (typeof AUTO_PUBLISH_CANDIDATE_EVENTS)[number][];

  @IsOptional()
  @IsIn(AUTO_PUBLISH_MODES)
  autoPublishMode?: (typeof AUTO_PUBLISH_MODES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_DAILY_CAP_MIN)
  @Max(AUTO_DAILY_CAP_MAX)
  autoDailyCap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_MIN_GAP_MIN_SECONDS)
  @Max(AUTO_MIN_GAP_MAX_SECONDS)
  autoMinGapSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietStartHour?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietEndHour?: number | null;

  @IsOptional()
  @IsIn(WITHDRAW_ACTIONS)
  withdrawAction?: (typeof WITHDRAW_ACTIONS)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  autoPublishCategoryIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

/** PATCH /omnichannel/connections/:id/publish-settings */
export class PatchConnectionPublishSettingsDto extends GoRefDto {
  @IsOptional()
  @IsIn(OOS_POLICIES)
  oosPolicy?: (typeof OOS_POLICIES)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(AUTO_PUBLISH_CANDIDATE_EVENTS, { each: true })
  autoPublishEventTypes?: (typeof AUTO_PUBLISH_CANDIDATE_EVENTS)[number][];

  @IsOptional()
  @IsIn(AUTO_PUBLISH_MODES)
  autoPublishMode?: (typeof AUTO_PUBLISH_MODES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_DAILY_CAP_MIN)
  @Max(AUTO_DAILY_CAP_MAX)
  autoDailyCap?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(AUTO_MIN_GAP_MIN_SECONDS)
  @Max(AUTO_MIN_GAP_MAX_SECONDS)
  autoMinGapSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietStartHour?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  quietEndHour?: number | null;

  @IsOptional()
  @IsIn(WITHDRAW_ACTIONS)
  withdrawAction?: (typeof WITHDRAW_ACTIONS)[number];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  autoPublishCategoryIds?: string[];

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

export class CreateDestinationDto extends GoRefDto {
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

  /** Primary scope for product templates (required for product.published admin writes). */
  @IsOptional()
  @IsUUID('4')
  destinationId?: string;

  /** Compat bind to one bot when destinationId omitted (fallback ensure only). */
  @IsOptional()
  @IsUUID('4')
  connectionId?: string;

  @IsString()
  @MaxLength(80)
  eventType: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  locale?: string;

  @IsString()
  @MaxLength(16000)
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
  @MaxLength(16000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PreviewDto {
  @IsUUID()
  @IsOptional()
  connectionId?: string;

  /** Prefer for template resolve (destination → connection → channel fallback). */
  @IsUUID()
  @IsOptional()
  destinationId?: string;

  @IsIn(OMNICHANNEL_CHANNELS)
  channel: (typeof OMNICHANNEL_CHANNELS)[number];

  @IsString()
  @MaxLength(40)
  sourceType: string;

  /** Required for PRODUCT / BLOG_POST / CMS_PAGE. FREE_POST may omit it; the server mints `free:<uuid>`. */
  @ValidateIf((o: { sourceType?: string }) => String(o.sourceType || '').toUpperCase() !== 'FREE_POST')
  @IsString()
  @MaxLength(80)
  sourceId?: string;

  /** FREE_POST caption. Ignored by the catalog preview path. */
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  caption?: string;

  /** Optional single image URL for FREE_POST. Catalog sends ignore it. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaUrl?: string;
}

export class CreatePublicationDto {
  @ValidateNested()
  @Type(() => PreviewDto)
  preview: PreviewDto;

  /** Default true — live canary requires an explicit false. */
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  /** Send to one destination only (test post). Must be the canary or a verified destination. */
  @IsOptional()
  @IsUUID()
  destinationId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ActorReasonDto extends GoRefDto {
  @IsString()
  @MaxLength(240)
  reason: string;
}

/** Admin bulk channel withdraw — same semantics as POST publications/:id/withdraw per id. */
export class BulkWithdrawPublicationsDto extends GoRefDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BULK_WITHDRAW_PUBLICATION_MAX)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

/** Soft-revive DEAD publication.deliver rows that failed only while connectors were off. */
export class ReviveConnectorDisabledDto extends GoRefDto {
  @IsBoolean()
  confirm: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  reason: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

/** Soft-cancel PENDING outbox rows (and stale PROCESSING). Never DELETE. */
export class ClearWaitingOutboxDto extends GoRefDto {
  @IsBoolean()
  confirm: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  reason: string;

  /** Default channel = messenger/catalog only; all = shared outbox including SMS/search. */
  @IsOptional()
  @IsIn(['all', 'channel'])
  scope?: 'all' | 'channel';

  /** When scope=channel: only cancel rows for these storefront channels (plus null/unscoped). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2)
  @ArrayUnique()
  @IsIn(OMNICHANNEL_CHANNELS, { each: true })
  channels?: Array<(typeof OMNICHANNEL_CHANNELS)[number]>;
}

/** Enqueue CREATE/UPDATE for every visible product in a category (batched). */
export class RequeueByCategoryDto extends GoRefDto {
  @IsIn(OMNICHANNEL_CHANNELS)
  channel: (typeof OMNICHANNEL_CHANNELS)[number];

  @IsUUID('4')
  categoryId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  reason: string;

  /** Required when dryRun is false. */
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @IsOptional()
  @IsUUID('4')
  destinationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class PatchMediaAltDto {
  @IsString()
  @MaxLength(200)
  altText: string;
}
