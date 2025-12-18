import { Injectable, UnauthorizedException } from '@nestjs/common';
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
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
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
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * JWT 토큰의 payload 검증
   * DB에서 사용자 정보를 조회하여 검증
   */
  async validate(payload: any) {
    // DB에서 사용자 조회
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      username: user.name || user.email,
      email: user.email,
      role: user.role,
      site_id: user.site_id,
    };
  }
}










































