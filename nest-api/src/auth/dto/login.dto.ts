import { IsString, MinLength } from 'class-validator';

/**
 * 로그인 DTO
 * - username 필드를 사용 (admin 또는 creator)
 */
export class LoginDto {
  @IsString()
  username: string; // "admin" or "creator"

  @IsString()
  @MinLength(1, { message: '비밀번호는 필수입니다.' })
  password: string;
}





































