import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 대량 영상 등록/편집 DTO
 * id가 있으면 update, 없으면 create
 * deleteChecked가 true이면 delete
 */
export class BulkVideoDto {
  @ApiPropertyOptional({
    description: '영상 ID (있으면 update, 없으면 create)',
    example: 'abc123',
  })
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({
    description: '영상 제목',
    example: '샘플 영상 제목',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: '영상 타입',
    enum: ['youtube', 'facebook', 'file'],
    example: 'youtube',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['youtube', 'facebook', 'file'])
  videoType: string;

  @ApiPropertyOptional({
    description: '소스 URL (videoType에 따라 자동 생성되거나 직접 입력)',
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
    description: '썸네일 URL (비어 있으면 자동 생성)',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
  })
  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

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
    description: '삭제 플래그 (true이면 삭제)',
    default: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  deleteChecked?: boolean;
}




