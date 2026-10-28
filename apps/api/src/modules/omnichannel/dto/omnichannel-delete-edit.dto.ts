import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class DeleteDeliveryMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(32)
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(64, { each: true })
  messageIds: string[];

  @IsString()
  @MinLength(1)
  @MaxLength(240)
  reason: string;

  /** Product SKU (PRODUCT) or literal FREE_POST / source token. */
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  confirmSku: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  goRef?: string;
}

export class EditDeliveryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  caption: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class RevertDeliveryDto {
  /** Backup uuid, or the literal "last" / "latest". */
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  backupId: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class WithdrawWithGoRefDto {
  @IsString()
  @MaxLength(240)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  goRef?: string;
}

export class BulkWithdrawWithGoRefDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  goRef?: string;
}

/** Optional query for delete-plan message subset (ignored when partial album disallowed). */
export class DeletePlanQueryDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined && v !== null && v !== '')
  @IsString()
  @MaxLength(512)
  messageIds?: string;

  @IsOptional()
  @Type(() => String)
  @IsString()
  dryRun?: string;
}
