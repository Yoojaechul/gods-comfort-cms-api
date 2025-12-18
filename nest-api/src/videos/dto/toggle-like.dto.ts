import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class ToggleLikeDto {
  @ApiPropertyOptional({
    description: '클라이언트 ID (UUID 형식, 선택사항)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @ValidateIf((o) => o.clientId !== undefined && o.clientId !== null)
  @IsString()
  @IsUUID()
  clientId?: string;
}

