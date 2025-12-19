import { IsString, MinLength } from 'class-validator';

/**
 * 비밀번호 변경 DTO
 * 현재 비밀번호 확인 후 새 비밀번호로 변경
 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: '현재 비밀번호는 필수입니다.' })
  current_password: string;

  @IsString()
  @MinLength(8, { message: '새 비밀번호는 최소 8자 이상이어야 합니다.' })
  new_password: string;
}



















































