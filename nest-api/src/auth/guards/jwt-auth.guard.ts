import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    const token = authHeader?.replace('Bearer ', '') || null;
    const hasToken = !!token;

    // ?좏겙 議댁옱 ?щ? 濡쒓퉭
    if (!hasToken) {
      this.logger.warn([JWT_AUTH] Authorization header missing - Path: , Method: );
    } else {
      this.logger.debug([JWT_AUTH] Token present (length=) - Path: , Method: );
    }

    const result = super.canActivate(context);
    
    // Observable??寃쎌슦?먮쭔 pipe ?ъ슜
    if (result instanceof Observable) {
      return result.pipe(
        tap((success) => {
          if (success) {
            this.logger.debug([JWT_AUTH] Authentication check passed - Path: , Method: );
          }
        }),
        catchError((error) => {
          this.logger.error([JWT_AUTH] Authentication check failed - Path: , Method: , Error: , error.stack);
          return throwError(() => error);
        })
      );
    }
    
    return result;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    if (err || !user) {
      // ?먮윭 ?먯씤蹂??곸꽭 濡쒓퉭
      if (err) {
        this.logger.error([JWT_AUTH] Authentication error - Path: , Method: , Error: , err.stack);
      } else if (info) {
        if (info.name === 'TokenExpiredError') {
          this.logger.warn([JWT_AUTH] Token expired - Path: , Method: , ExpiredAt: );
        } else if (info.name === 'JsonWebTokenError') {
          this.logger.warn([JWT_AUTH] Invalid token - Path: , Method: , Message: );
        } else if (info.name === 'NotBeforeError') {
          this.logger.warn([JWT_AUTH] Token not active yet - Path: , Method: , Date: );
        } else {
          this.logger.warn([JWT_AUTH] Authentication failed - Path: , Method: , Info: );
        }
      } else {
        this.logger.warn([JWT_AUTH] User not found in token - Path: , Method: );
      }
      
      throw new UnauthorizedException('?몄쬆???꾩슂?⑸땲?? ?좏슚??JWT ?좏겙???쒓났?댁＜?몄슂.');
    }

    // ?ъ슜???뺣낫 濡쒓퉭 (誘쇨컧 ?뺣낫 ?쒖쇅)
    this.logger.debug([JWT_AUTH] Authentication successful - Path: , Method: , UserId: , Role: );
    
    return user;
  }
}
