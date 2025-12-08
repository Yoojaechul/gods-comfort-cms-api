import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 영상 수정 DTO
 */
export class UpdateVideoDto {
  @ApiPropertyOptional({
    description: '영상 제목',
    example: '수정된 영상 제목',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: '썸네일 URL',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: '공개 설정',
    enum: ['public', 'private'],
    example: 'public',
  })
  @IsString()
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: string;

  @ApiPropertyOptional({
    description: '언어',
    example: 'ko',
  })
  @IsString()
  @IsOptional()
  language?: string;
}




































