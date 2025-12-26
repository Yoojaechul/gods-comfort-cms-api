import { IsString, IsEmail, MinLength } from 'class-validator';

/**
 * 이메일 기반 비밀번호 변경 DTO
 * JWT 없이 email + currentPassword + newPassword로 비밀번호 변경
 */
export class ChangePasswordEmailDto {
  @IsString()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(1, { message: '현재 비밀번호는 필수입니다.' })
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: '새 비밀번호는 최소 8자 이상이어야 합니다.' })
  newPassword: string;
}




