import { IsEnum, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum SourceType {
  YouTube = 'YouTube',
  Facebook = 'Facebook',
}

export class VideoMetadataRequestDto {
  @ApiProperty({
    enum: SourceType,
    description: '영상 출처 타입',
    example: 'YouTube',
  })
  @IsEnum(SourceType)
  @IsNotEmpty()
  sourceType: SourceType;

  @ApiProperty({
    description: '영상 URL',
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  })
  @IsString()
  @IsNotEmpty()
  sourceUrl: string;
}

export class VideoMetadataResponseDto {
  @ApiProperty({
    description: '영상 제목',
    example: 'Example Video Title',
    nullable: true,
  })
  title: string | null;

  @ApiProperty({
    description: '썸네일 URL',
    example: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    nullable: true,
  })
  thumbnailUrl: string | null;

  @ApiProperty({
    description: '추출된 Video ID',
    example: 'dQw4w9WgXcQ',
    nullable: true,
  })
  videoId: string | null;
}

































