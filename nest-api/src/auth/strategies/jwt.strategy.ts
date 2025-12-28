import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';

/**
 * JWT 인증 전략
 * Authorization: Bearer <token> 헤더 또는 쿠키에서 토큰 추출
 * 우선순위:
 * 1. Authorization: Bearer <token>
 * 2. req.cookies['cms_token'] 또는 req.cookies['access_token']
 * 
 * @requires JWT_SECRET 환경변수가 반드시 설정되어 있어야 합니다.
 * Cloud Run 배포 시 환경변수 설정을 확인하세요.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    // ConfigService를 통해 JWT_SECRET 읽기
    const jwtSecret = configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET;

    // JWT_SECRET 필수 체크 - startup 단계에서 명확한 에러 로그 출력
    if (!jwtSecret || jwtSecret.trim() === '') {
      const errorMessage = `
❌ [FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다.

Cloud Run 배포 시 필수 환경변수:
  - JWT_SECRET: JWT 토큰 서명에 사용되는 비밀키 (필수)

설정 방법:
  1. gcloud run services update 명령어 사용:
     gcloud run services update cms-api --set-env-vars "JWT_SECRET=your-secret-key" --region asia-northeast3
  
  2. Cloud Run 콘솔에서 환경변수 추가

현재 JWT_SECRET 값: ${jwtSecret === undefined ? 'undefined' : `'${jwtSecret}' (empty string)`}
      `.trim();

      // Logger를 사용하여 명확한 에러 로그 출력 (super() 호출 전이므로 직접 생성)
      new Logger('JwtStrategy').error(errorMessage);
      
      // 서버 시작을 막기 위해 에러 throw (JWT_SECRET은 필수이므로 서버를 시작할 수 없음)
      throw new Error(
        'JWT_SECRET environment variable is required. ' +
        'Please set JWT_SECRET environment variable for Cloud Run deployment. ' +
        'See README.md for required environment variables list.'
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Authorization Bearer 헤더에서 토큰 추출
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // 2. 쿠키에서 토큰 추출 (cms_token 또는 access_token)
        (request: Request) => {
          if (request && request.cookies) {
            return request.cookies['cms_token'] || request.cookies['access_token'] || null;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });

    // JWT_SECRET이 정상적으로 설정되었음을 로그로 확인 (디버깅용)
    this.logger.log(`✅ JWT_SECRET 환경변수가 설정되었습니다 (길이: ${jwtSecret.length}자)`);
  }

  /**
   * JWT 토큰의 payload 검증
   * DB에서 사용자 정보를 조회하여 검증
   * 
   * @returns { id, email, role, ... } 형태로 정규화된 사용자 정보
   */
  async validate(payload: any) {
    // payload에서 기본 정보 추출 (로그용)
    const payloadInfo = {
      id: payload.sub || payload.id || null,
      email: payload.email || null,
      role: payload.role || null,
    };

    // payload 로그 출력 (민감정보 제외, id/email/role만)
    this.logger.log(
      `[JWT_VALIDATE] payload 검증 시작: id=${payloadInfo.id}, email=${payloadInfo.email}, role=${payloadInfo.role}`
    );

    // DB에서 사용자 조회
    const userId = payload.sub || payload.id;
    if (!userId) {
      this.logger.warn('[JWT_VALIDATE] payload에 사용자 ID(sub/id)가 없습니다.');
      throw new UnauthorizedException('Invalid token: user ID not found');
    }

    const user = await this.authService.validateUser(userId);

    if (!user) {
      this.logger.warn(`[JWT_VALIDATE] 사용자를 찾을 수 없습니다: userId=${userId}`);
      throw new UnauthorizedException('User not found');
    }

    // 정규화된 사용자 정보 반환 (id/email/role 필수 포함)
    const normalizedUser = {
      id: user.id,
      email: user.email || null,
      role: user.role || null,
      // 추가 필드 (선택적)
      username: user.name || user.email || null,
      site_id: user.site_id || null,
    };

    // 필수 필드 검증
    if (!normalizedUser.id) {
      this.logger.error('[JWT_VALIDATE] 사용자 정보에 id가 없습니다.');
      throw new UnauthorizedException('Invalid user data: id is required');
    }
    if (!normalizedUser.email) {
      this.logger.warn(`[JWT_VALIDATE] 사용자 정보에 email이 없습니다: id=${normalizedUser.id}`);
    }
    if (!normalizedUser.role) {
      this.logger.warn(`[JWT_VALIDATE] 사용자 정보에 role이 없습니다: id=${normalizedUser.id}`);
    }

    this.logger.log(
      `[JWT_VALIDATE] 검증 완료: id=${normalizedUser.id}, email=${normalizedUser.email}, role=${normalizedUser.role}`
    );

    return normalizedUser;
  }
}










































