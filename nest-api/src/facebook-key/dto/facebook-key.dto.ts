import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Facebook Key 저장 DTO
 */
export class SaveFacebookKeyDto {
  @ApiProperty({
    description: 'Facebook API Key',
    example: 'EAABwzLixnjYBO7ZC...',
  })
  @IsString()
  @IsNotEmpty()
  key: string;
}





























