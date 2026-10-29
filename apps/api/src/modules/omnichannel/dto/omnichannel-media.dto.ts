import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** POST /omnichannel/media/validate — url or storageKey, never tokens. */
export class ValidateMediaDto {
  @ValidateIf((o: ValidateMediaDto) => !o.storageKey)
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  url?: string;

  @ValidateIf((o: ValidateMediaDto) => !o.url)
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  storageKey?: string;
}

/** POST /omnichannel/media/scan — paginated chunk; no full-catalog decode. */
export class ScanMediaDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class MarkMediaNeedsReplaceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

/** Path param helper for OpenAPI; Nest uses string id. */
export class MediaAssetIdParam {
  @IsUUID('4')
  id: string;
}
