import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ALLOWED_ORIGINS } from '../constants/cors.constants';

/**
 * Global Exception Filter
 * 모든 예외에 대해 CORS 헤더를 포함하여 응답
 * 
 * 중요: 에러 응답(401, 500 등)에도 Access-Control-Allow-Origin 헤더가 
 * 포함되어야 브라우저에서 CORS 오류가 발생하지 않습니다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 예외에서 상태 코드와 메시지 추출
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // 에러 로깅 (Cloud Run에서 확인 가능하도록)
    const errorDetails = exception instanceof Error 
      ? { message: exception.message, stack: exception.stack }
      : String(exception);
    
    console.error(`[ExceptionFilter] ${request.method} ${request.url} - Status: ${status}`, {
      status,
      error: errorDetails,
      origin: request.headers.origin,
      body: request.body,
    });

    // CORS 헤더 설정 (에러 응답에도 필수!)
    // 모든 응답에 CORS 헤더를 명시적으로 추가
    const origin = request.headers.origin;
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    } else if (!origin) {
      // origin이 없는 경우에도 CORS 헤더는 설정 (서버 간 호출)
      // 하지만 credentials는 설정하지 않음
    }
    
    // 항상 설정해야 하는 CORS 헤더들
    response.setHeader(
      'Access-Control-Allow-Methods',
      'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
    );
    response.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type,Authorization,X-Requested-With',
    );

    // 응답 본문 생성
    const responseBody =
      typeof message === 'string'
        ? { statusCode: status, message }
        : { statusCode: status, ...message };

    // CORS 헤더가 설정된 후 응답 전송
    response.status(status).json(responseBody);
  }
}

