import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ALLOWED_ORIGINS } from '../constants/cors.constants';

/**
 * CORS Response Interceptor
 * 모든 정상 응답(200, 201 등)에 CORS 헤더를 명시적으로 추가
 * 
 * NestJS의 enableCors()가 정상 응답에도 CORS 헤더를 추가해야 하지만,
 * 추가 보장을 위해 Interceptor로 처리합니다.
 */
@Injectable()
export class CorsResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        // 정상 응답에도 CORS 헤더 명시적으로 추가
        const origin = request.headers.origin;
        if (origin && ALLOWED_ORIGINS.includes(origin)) {
          if (!response.getHeader('Access-Control-Allow-Origin')) {
            response.setHeader('Access-Control-Allow-Origin', origin);
          }
          if (!response.getHeader('Access-Control-Allow-Credentials')) {
            response.setHeader('Access-Control-Allow-Credentials', 'true');
          }
        }

        // 항상 설정해야 하는 CORS 헤더들
        if (!response.getHeader('Access-Control-Allow-Methods')) {
          response.setHeader(
            'Access-Control-Allow-Methods',
            'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
          );
        }
        if (!response.getHeader('Access-Control-Allow-Headers')) {
          response.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type,Authorization,X-Requested-With',
          );
        }
      }),
    );
  }
}












