import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoRefDto } from './omnichannel.dto';

export class CoverageAbsenceReasonDto {
  @ApiPropertyOptional({ description: 'null = row-wide reason for all destinations' })
  destinationId?: string | null;

  @ApiProperty({ maxLength: 500 })
  reason: string;
}

export class OutOfPanelIngestEventDto {
  @ApiProperty({ description: 'TELEGRAM | BALE | RUBIKA or sales channel label' })
  channel: string;

  @ApiPropertyOptional()
  destinationId?: string | null;

  @ApiPropertyOptional()
  productId?: string | null;

  @ApiProperty()
  providerMessageId: string;

  @ApiProperty({ enum: ['CREATE', 'DELETE'] })
  action: 'CREATE' | 'DELETE';

  @ApiProperty({ description: 'ISO timestamp of the out-of-panel event' })
  occurredAt: string;

  @ApiPropertyOptional()
  note?: string | null;
}

export class OutOfPanelIngestDto extends GoRefDto {
  @ApiProperty({ type: [OutOfPanelIngestEventDto] })
  events: OutOfPanelIngestEventDto[];
}
