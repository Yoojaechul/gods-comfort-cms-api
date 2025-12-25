import { IsString, IsEmail } from 'class-validator';

/**
 * 이메일 확인 DTO
 * 이메일이 존재하는지 확인
 */
export class CheckEmailDto {
  @IsString()
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;
}


