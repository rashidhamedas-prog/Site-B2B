import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PatchOrderBotDto {
  @ApiProperty({ description: 'Enable order bot for this connection (Owner + goRef)' })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ description: 'Written Owner GO reference' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  goRef!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}

export class BotInboxReplyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @ApiPropertyOptional({ description: 'Required when bot OFF and RBAC on (Owner support-only)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  goRef?: string;
}

export class BotInboxReferSocialDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  goRef?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BotInboxMarkAnsweredDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  goRef?: string;
}

export class TestOwnerChatDto {
  @ApiProperty({ description: 'Owner GO reference' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  goRef!: string;
}
