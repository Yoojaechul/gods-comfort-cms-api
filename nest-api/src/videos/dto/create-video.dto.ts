import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 영상 생성 DTO
 */
export class CreateVideoDto {
  @ApiPropertyOptional({
    description: '영상 제목',
    example: '샘플 영상 제목',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: '영상 타입',
    enum: ['youtube', 'facebook', 'file'],
    example: 'youtube',
  })
  @IsString()
  @IsOptional()
  @IsIn(['youtube', 'facebook', 'file'])
  videoType?: string;

  @ApiPropertyOptional({
    description: '소스 타입 (videoType과 동일, 호환성용)',
    enum: ['youtube', 'facebook', 'file'],
    example: 'youtube',
  })
  @IsString()
  @IsOptional()
  @IsIn(['youtube', 'facebook', 'file'])
  sourceType?: string;

  @ApiPropertyOptional({
    description: '소스 URL (직접 입력)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @ApiPropertyOptional({
    description: 'YouTube 동영상 ID (videoType이 youtube일 때)',
    example: 'dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  youtubeId?: string;

  @ApiPropertyOptional({
    description: 'Facebook 동영상 ID (videoType이 facebook일 때)',
    example: '1234567890',
  })
  @IsString()
  @IsOptional()
  facebookVideoId?: string;

  @ApiPropertyOptional({
    description: '언어 코드',
    default: 'ko',
    example: 'ko',
  })
  @IsString()
  @IsOptional()
  languageCode?: string;

  @ApiPropertyOptional({
    description: '공개 여부',
    default: true,
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: '썸네일 URL (비어 있으면 자동 생성)',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;
}


















