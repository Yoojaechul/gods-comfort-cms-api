import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: '루트 엔드포인트' })
  @ApiResponse({ status: 200, description: '서비스 정보' })
  root() {
    return {
      service: 'cms-api',
      status: 'ok',
    };
  }

  @Get('health')
  @ApiOperation({ summary: '헬스 체크' })
  @ApiResponse({ status: 200, description: '서버 정상 동작 중' })
  healthCheck() {
    // 버전 정보 (배포된 서버가 예상한 버전인지 확인용)
    const buildInfo: any = {};

    // Git commit SHA
    try {
      if (process.env.GIT_COMMIT_SHA) {
        buildInfo.gitCommitSha = process.env.GIT_COMMIT_SHA.substring(0, 7);
      } else {
        const gitHeadPath = path.join(process.cwd(), '.git', 'HEAD');
        if (fs.existsSync(gitHeadPath)) {
          const headContent = fs.readFileSync(gitHeadPath, 'utf-8').trim();
          if (headContent.startsWith('ref: ')) {
            const refPath = path.join(process.cwd(), '.git', headContent.substring(5));
            if (fs.existsSync(refPath)) {
              buildInfo.gitCommitSha = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
            }
          } else {
            buildInfo.gitCommitSha = headContent.substring(0, 7);
          }
        }
      }
    } catch (error) {
      // buildInfo에 추가하지 않음
    }

    // Build timestamp
    try {
      if (process.env.BUILD_TIMESTAMP) {
        buildInfo.buildTimestamp = process.env.BUILD_TIMESTAMP;
      } else {
        const distMainPath = path.join(process.cwd(), 'dist', 'main.js');
        if (fs.existsSync(distMainPath)) {
          const stats = fs.statSync(distMainPath);
          buildInfo.buildTimestamp = stats.mtime.toISOString();
        }
      }
    } catch (error) {
      // buildInfo에 추가하지 않음
    }

    const result: any = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      appName: 'godscomfortword-nest-api',
      nodeEnv: process.env.NODE_ENV || 'development',
    };

    // buildInfo가 비어있지 않으면 추가
    if (Object.keys(buildInfo).length > 0) {
      result.buildInfo = buildInfo;
    }

    return result;
  }
}

