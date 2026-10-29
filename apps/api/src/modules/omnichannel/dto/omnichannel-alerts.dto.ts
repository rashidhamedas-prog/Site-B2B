import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ListOmnichannelAlertsQueryDto {
  @ApiPropertyOptional({ enum: ['open', 'acked', 'resolved', 'all'] })
  @IsOptional()
  @IsString()
  @IsIn(['open', 'acked', 'resolved', 'all'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  destinationId?: string;
}

export class AckOmnichannelAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}

export class ResolveOmnichannelAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(240)
  reason?: string;
}
