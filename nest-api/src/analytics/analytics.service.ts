import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

/**
 * 접속자 통계 서비스
 */
@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 대시보드용 접속자 통계 조회 (샘플 데이터)
   */
  async getAnalyticsForDashboard(range: string) {
    // 샘플 데이터 반환 (나중에 실제 로그 연결)
    const sampleData = {
      weekly: {
        totalVisitors: 1234,
        byLanguage: [
          { language: 'ko', count: 400 },
          { language: 'en', count: 300 },
          { language: 'es', count: 200 },
          { language: 'zh', count: 150 },
          { language: 'ja', count: 100 },
        ],
        byCountry: [
          { country: 'KR', count: 500 },
          { country: 'US', count: 300 },
          { country: 'ES', count: 150 },
          { country: 'CN', count: 100 },
          { country: 'JP', count: 80 },
        ],
      },
      monthly: {
        totalVisitors: 5678,
        byLanguage: [
          { language: 'ko', count: 2000 },
          { language: 'en', count: 1500 },
          { language: 'es', count: 1000 },
          { language: 'zh', count: 800 },
          { language: 'ja', count: 378 },
        ],
        byCountry: [
          { country: 'KR', count: 2500 },
          { country: 'US', count: 1500 },
          { country: 'ES', count: 800 },
          { country: 'CN', count: 500 },
          { country: 'JP', count: 378 },
        ],
      },
      quarterly: {
        totalVisitors: 15000,
        byLanguage: [
          { language: 'ko', count: 6000 },
          { language: 'en', count: 4500 },
          { language: 'es', count: 3000 },
          { language: 'zh', count: 1000 },
          { language: 'ja', count: 500 },
        ],
        byCountry: [
          { country: 'KR', count: 7000 },
          { country: 'US', count: 4500 },
          { country: 'ES', count: 2000 },
          { country: 'CN', count: 1000 },
          { country: 'JP', count: 500 },
        ],
      },
      halfyear: {
        totalVisitors: 30000,
        byLanguage: [
          { language: 'ko', count: 12000 },
          { language: 'en', count: 9000 },
          { language: 'es', count: 6000 },
          { language: 'zh', count: 2000 },
          { language: 'ja', count: 1000 },
        ],
        byCountry: [
          { country: 'KR', count: 14000 },
          { country: 'US', count: 9000 },
          { country: 'ES', count: 4000 },
          { country: 'CN', count: 2000 },
          { country: 'JP', count: 1000 },
        ],
      },
      yearly: {
        totalVisitors: 60000,
        byLanguage: [
          { language: 'ko', count: 24000 },
          { language: 'en', count: 18000 },
          { language: 'es', count: 12000 },
          { language: 'zh', count: 4000 },
          { language: 'ja', count: 2000 },
        ],
        byCountry: [
          { country: 'KR', count: 28000 },
          { country: 'US', count: 18000 },
          { country: 'ES', count: 8000 },
          { country: 'CN', count: 4000 },
          { country: 'JP', count: 2000 },
        ],
      },
    };

    // range에 맞는 데이터 반환 (기본값: weekly)
    const validRange = ['weekly', 'monthly', 'quarterly', 'halfyear', 'yearly'].includes(range)
      ? range
      : 'weekly';

    return sampleData[validRange as keyof typeof sampleData];
  }

  /**
   * 접속자 통계 조회 (기존 메서드 유지)
   */
  async getAnalytics(options: {
    siteId: string;
    period?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const { siteId, period = 'daily', startDate, endDate } = options;

    try {
      const db = this.databaseService.getDb();

      // visits 테이블 존재 확인
      const tableExists = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='visits'",
        )
        .get();

      if (!tableExists) {
        this.logger.warn('visits 테이블이 존재하지 않습니다.');
        return {
          period,
          start_date: startDate || '',
          end_date: endDate || '',
          total_visits: 0,
          by_country: [],
          by_language: [],
          daily_trend: [],
          unique_countries: 0,
          unique_languages: 0,
        };
      }

      // 날짜 범위 계산
      let startDateStr: string;
      let endDateStr: string;

      if (startDate && endDate) {
        startDateStr = startDate;
        endDateStr = endDate;
      } else {
        const now = new Date();
        let startDate: Date;

        switch (period) {
          case 'daily':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'weekly':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case 'monthly':
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case 'quarterly':
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          case 'half-yearly':
            startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
            break;
          case 'yearly':
            startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        }

        startDateStr = startDate.toISOString().split('T')[0];
        endDateStr = now.toISOString().split('T')[0];
      }

      // 총 방문자 수
      const totalVisits = db
        .prepare(
          'SELECT COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ?',
        )
        .get(siteId, startDateStr, endDateStr) as { count: number };

      // 국가별 통계
      const byCountry = db
        .prepare(
          'SELECT country_code, country_name, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY country_code, country_name ORDER BY count DESC',
        )
        .all(siteId, startDateStr, endDateStr) as any[];

      // 언어별 통계
      const byLanguage = db
        .prepare(
          'SELECT language, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY language ORDER BY count DESC',
        )
        .all(siteId, startDateStr, endDateStr) as any[];

      // 일별 방문자 추이
      const dailyTrend = db
        .prepare(
          'SELECT date(created_at) as date, COUNT(*) as count FROM visits WHERE site_id = ? AND date(created_at) >= ? AND date(created_at) <= ? GROUP BY date(created_at) ORDER BY date DESC LIMIT 90',
        )
        .all(siteId, startDateStr, endDateStr) as any[];

      return {
        period,
        start_date: startDateStr,
        end_date: endDateStr,
        total_visits: totalVisits.count,
        by_country: byCountry,
        by_language: byLanguage,
        daily_trend: dailyTrend,
        unique_countries: byCountry.length,
        unique_languages: byLanguage.length,
      };
    } catch (error) {
      this.logger.error('통계 조회 오류:', error);
      throw error;
    }
  }
}






































































































