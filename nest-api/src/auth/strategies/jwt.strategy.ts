import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

/**
 * JWT 인증 전략
 * Authorization: Bearer <token> 헤더에서 토큰 추출
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * JWT 토큰의 payload 검증
   */
  async validate(payload: any) {
    // For hardcoded accounts, validate from payload directly
    // Hardcoded accounts mapping
    const accounts = {
      'admin-001': { id: 'admin-001', username: 'admin', role: 'admin', site_id: null },
      'creator-001': { id: 'creator-001', username: 'creator', role: 'creator', site_id: 'gods' },
    };

    const account = accounts[payload.sub as keyof typeof accounts];
    if (!account) {
      throw new UnauthorizedException();
    }

    return {
      id: payload.sub,
      username: payload.username || account.username,
      email: payload.email,
      role: payload.role,
      site_id: payload.site_id || account.site_id,
    };
  }
}







































