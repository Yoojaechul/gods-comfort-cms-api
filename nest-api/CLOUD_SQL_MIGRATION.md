# Cloud SQL 마이그레이션 가이드

## 문제 상황

현재 NestJS API는 SQLite 파일 기반 데이터베이스를 사용하고 있습니다 (`/app/data/cms.db`).

**Cloud Run 환경에서의 문제점:**
- Cloud Run의 파일시스템은 **ephemeral(임시)**입니다
- 재배포, 인스턴스 교체, 컨테이너 재시작 시 **데이터가 유실**됩니다
- 여러 인스턴스가 동시에 실행되면 **각 인스턴스마다 별도의 DB 파일**을 가지게 됩니다
- "어제 등록한 영상이 오늘 사라짐" 현상의 원인입니다

## 해결 방법: Cloud SQL (PostgreSQL) 전환

Cloud SQL은 Google Cloud의 관리형 데이터베이스 서비스로, **영구 저장소**를 제공합니다.

### 1. Cloud SQL 인스턴스 생성

```bash
# PostgreSQL 인스턴스 생성
gcloud sql instances create cms-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=asia-northeast3 \
  --root-password=<ROOT_PASSWORD> \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase

# 데이터베이스 생성
gcloud sql databases create cms --instance=cms-db

# 사용자 생성
gcloud sql users create cms_user \
  --instance=cms-db \
  --password=<USER_PASSWORD>
```

### 2. Cloud Run 서비스 계정 권한 설정

```bash
# Cloud Run 서비스 계정에 Cloud SQL Client 역할 부여
PROJECT_ID=$(gcloud config get-value project)
SERVICE_ACCOUNT="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudsql.client"
```

### 3. Cloud Run 서비스에 Cloud SQL 연결 설정

```bash
# Cloud Run 서비스 업데이트 (Cloud SQL 연결 추가)
gcloud run services update cms-api \
  --region=asia-northeast3 \
  --add-cloudsql-instances=${PROJECT_ID}:asia-northeast3:cms-db \
  --set-env-vars="DATABASE_URL=postgresql://cms_user:${USER_PASSWORD}@/cms?host=/cloudsql/${PROJECT_ID}:asia-northeast3:cms-db"
```

### 4. NestJS 코드 수정

#### 4.1. `package.json`에 PostgreSQL 드라이버 추가

```json
{
  "dependencies": {
    "pg": "^8.11.3",
    "typeorm": "^0.3.17"
  }
}
```

#### 4.2. `DatabaseService` 수정

SQLite 대신 PostgreSQL을 사용하도록 변경:

```typescript
// src/database/database.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const databaseUrl = this.configService.get<string>('DATABASE_URL');
    
    if (!databaseUrl) {
      this.logger.error('[FATAL] DATABASE_URL 환경변수가 설정되지 않았습니다.');
      throw new Error('DATABASE_URL is required');
    }

    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: false, // Cloud SQL은 Unix 소켓 사용 시 SSL 불필요
    });

    this.logger.log('[DB] ✅ PostgreSQL 연결 성공');
    
    // 스키마 생성
    await this.ensureSchema();
  }

  getDb(): Pool {
    return this.pool;
  }

  // ... 나머지 메서드들을 PostgreSQL 쿼리로 변경
}
```

### 5. 데이터 마이그레이션

기존 SQLite 데이터를 PostgreSQL로 마이그레이션:

```bash
# SQLite 데이터 추출
sqlite3 cms.db .dump > dump.sql

# PostgreSQL 형식으로 변환 후 import
psql -h /cloudsql/${PROJECT_ID}:asia-northeast3:cms-db \
  -U cms_user \
  -d cms \
  -f dump.sql
```

### 6. 배포 및 테스트

```bash
# 빌드 및 배포
npm run build
gcloud builds submit --config cloudbuild.yaml

# 테스트
curl -X POST "https://api.godcomfortword.com/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"j1d1y1@naver.com","password":"123456789QWER"}'
```

## 임시 해결책: Cloud Storage FUSE (권장하지 않음)

Cloud SQL 전환이 어려운 경우, Cloud Storage FUSE를 사용하여 SQLite 파일을 영구 저장소에 저장할 수 있습니다.

**주의:** 이 방법은 **성능이 낮고 동시성 문제**가 있을 수 있습니다. 운영 환경에서는 **반드시 Cloud SQL을 사용**하는 것을 권장합니다.

### Cloud Storage FUSE 설정

```bash
# Cloud Storage 버킷 생성
gsutil mb -l asia-northeast3 gs://${PROJECT_ID}-cms-db

# Cloud Run 서비스에 FUSE 마운트 추가
gcloud run services update cms-api \
  --region=asia-northeast3 \
  --set-env-vars="SQLITE_DB_PATH=/mnt/gcs/cms.db" \
  --add-volume=name=db-storage,type=cloud-storage,bucket=${PROJECT_ID}-cms-db \
  --add-volume-mount=volume=db-storage,mount-path=/mnt/gcs
```

## 권장 사항

1. **즉시 조치:** Cloud SQL 인스턴스 생성 및 연결 설정
2. **코드 수정:** PostgreSQL 드라이버로 전환
3. **데이터 마이그레이션:** 기존 SQLite 데이터를 PostgreSQL로 이전
4. **테스트:** 배포 후 모든 엔드포인트 정상 동작 확인

## 비용 고려사항

- **Cloud SQL (db-f1-micro):** 약 $7-10/월
- **Cloud Storage FUSE:** 약 $0.02/GB/월 (저장소) + 네트워크 비용

운영 환경에서는 **Cloud SQL 사용을 강력히 권장**합니다.

