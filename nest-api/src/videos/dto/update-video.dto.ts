import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateVideoDto {
  @ApiPropertyOptional({
    description: '영상 소스 타입 (youtube 또는 facebook)',
    example: 'youtube',
    enum: ['youtube', 'facebook'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['youtube', 'facebook'])
  sourceType?: string;

  @ApiPropertyOptional({
    description: '영상 소스 URL (다양한 키로 받을 수 있음: sourceUrl, source_url, url, youtubeUrl, youtube_url, facebookUrl, facebook_url)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  sourceUrl?: string;

  @ApiPropertyOptional({
    description: '영상 소스 URL (camelCase)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  source_url?: string;

  @ApiPropertyOptional({
    description: '영상 URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  url?: string;

  @ApiPropertyOptional({
    description: 'YouTube URL (camelCase)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  youtubeUrl?: string;

  @ApiPropertyOptional({
    description: 'YouTube URL (snake_case)',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsOptional()
  youtube_url?: string;

  @ApiPropertyOptional({
    description: 'Facebook URL (camelCase)',
    example: 'https://www.facebook.com/videos/123456789',
  })
  @IsString()
  @IsOptional()
  facebookUrl?: string;

  @ApiPropertyOptional({
    description: 'Facebook URL (snake_case)',
    example: 'https://www.facebook.com/videos/123456789',
  })
  @IsString()
  @IsOptional()
  facebook_url?: string;

  @ApiPropertyOptional({
    description: '영상 제목',
    example: '샘플 영상',
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: '썸네일 URL',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({
    description: '언어 코드',
    example: 'ko',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: '영상 상태',
    example: 'active',
    enum: ['active', 'inactive'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional({
    description: '공개 설정',
    example: 'public',
    enum: ['public', 'private'],
  })
  @IsString()
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: string;

  @ApiPropertyOptional({
    description: '사이트 ID (admin만 설정 가능, creator는 자동으로 자신의 site_id 사용)',
    example: 'gods',
  })
  @IsString()
  @IsOptional()
  site_id?: string;
}
