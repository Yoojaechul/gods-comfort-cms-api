import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * 최초 비밀번호 설정용 DTO
 * - email 필드는 "로그인 ID" 로 사용 (전화번호 형태도 허용)
 */
export class SetupPasswordDto {
  @IsString()
  email: string; // 예: "01023942042" 처럼 전화번호도 허용

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  new_password: string;

  // 필요하면 이메일을 새로 바꿀 때 사용 (선택 값)
  @IsOptional()
  @IsString()
  new_email?: string;
}



































































































