import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class AdminWalletAdjustDto {
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'] })
  @IsIn(['CREDIT', 'DEBIT'])
  direction: 'CREDIT' | 'DEBIT';

  @ApiProperty({ description: 'مبلغ به تومان' })
  @IsInt()
  @Min(1)
  @Max(5_000_000_000)
  amountToman: number;

  @ApiProperty({ example: 'جبران تأخیر ارسال' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  note: string;

  @ApiProperty({ example: 'ui:admin:credit:uuid' })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  idempotencyKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;
}
