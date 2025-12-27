import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({
    description: '영상 소스 타입 (youtube 또는 facebook)',
    example: 'youtube',
    enum: ['youtube', 'facebook'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['youtube', 'facebook'])
  sourceType: string;

  @ApiProperty({
    description: '영상 소스 URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsNotEmpty()
  sourceUrl: string;

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
    default: 'en',
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiPropertyOptional({
    description: '영상 상태',
    example: 'active',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  @IsString()
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;

  @ApiPropertyOptional({
    description: '공개 설정',
    example: 'public',
    enum: ['public', 'private'],
    default: 'public',
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
