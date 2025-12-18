import { IsString, MinLength, IsOptional, ValidateIf } from 'class-validator';

/**
 * 로그인 DTO
 * - username 또는 email 필드를 사용 가능
 * - 둘 중 하나는 반드시 제공해야 함
 */
export class LoginDto {
  @ValidateIf((o) => !o.email)
  @IsString({ message: 'username 또는 email 중 하나는 필수입니다.' })
  username?: string; // username 또는 email 중 하나

  @ValidateIf((o) => !o.username)
  @IsString({ message: 'username 또는 email 중 하나는 필수입니다.' })
  email?: string; // username 또는 email 중 하나

  @IsString()
  @MinLength(1, { message: '비밀번호는 필수입니다.' })
  password: string;
}








































