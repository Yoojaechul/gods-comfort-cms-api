# SQLite 영구 저장소 설정 가이드

## 📋 변경 사항 요약

### 수정된 파일
- `src/database/database.service.ts`

### 변경 내용
1. ✅ SQLite DB 경로를 환경변수 `SQLITE_DB_PATH`로 고정 가능하게 변경
   - 기본값: `/app/data/cms.db`
   - 우선순위: `SQLITE_DB_PATH` > `DB_PATH` > `/app/data/cms.db`
2. ✅ `/app/data` 디렉터리 자동 생성 (없으면 생성)
3. ✅ 로그에 "Using SQLite DB Path: ..." 1회 출력

## 🔧 코드 변경 사항

### Before
```typescript
// 여러 줄의 로그 출력
this.logger.log(`[DB] 드라이버: better-sqlite3`);
this.logger.log(`[DB] DB 파일 경로: ${dbPath}`);
this.logger.log(`[DB] SQLITE_DB_PATH env: ${process.env.SQLITE_DB_PATH || '(not set)'}`);
this.logger.log(`[DB] DB_PATH env: ${process.env.DB_PATH || '(not set)'}`);
```

### After
```typescript
// 간결한 1줄 로그 출력
this.logger.log(`Using SQLite DB Path: ${dbPath}`);

// DB 디렉터리 자동 생성 (없으면 생성)
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  this.logger.log(`[DB] 디렉터리 생성: ${dbDir}`);
}
```

## ☁️ Cloud Run 영구 볼륨 마운트

### 방법 1: Cloud Storage FUSE (권장)

Cloud Storage 버킷을 FUSE로 마운트하여 `/app/data`를 영구 저장소로 사용합니다.

#### 1. Cloud Storage 버킷 생성

```powershell
# 버킷 생성 (리전: asia-northeast3)
gsutil mb -p esoteric-throne-471613-j6 -l asia-northeast3 gs://cms-api-db-storage

# 버킷 확인
gsutil ls -b gs://cms-api-db-storage
```

#### 2. Cloud Run 서비스에 볼륨 마운트 설정

```powershell
# Cloud Run 서비스 업데이트 (볼륨 마운트 추가)
gcloud run services update cms-api `
  --region asia-northeast3 `
  --add-volume name=cms-db-storage,type=cloud-storage,bucket=cms-api-db-storage `
  --add-volume-mount volume=cms-db-storage,mount-path=/app/data
```

#### 3. 환경변수 설정

```powershell
# SQLITE_DB_PATH 환경변수 설정 (기본값과 동일하지만 명시적으로 설정)
gcloud run services update cms-api `
  --region asia-northeast3 `
  --update-env-vars "SQLITE_DB_PATH=/app/data/cms.db"
```

### 방법 2: Filestore (NFS)

Filestore 인스턴스를 생성하고 NFS로 마운트합니다.

#### 1. Filestore 인스턴스 생성

```powershell
# Filestore 인스턴스 생성
gcloud filestore instances create cms-db-filestore `
  --project=esoteric-throne-471613-j6 `
  --zone=asia-northeast3-a `
  --tier=BASIC_HDD `
  --file-share=name="cms-db",capacity=1TB `
  --network=name="default"
```

#### 2. Cloud Run 서비스에 볼륨 마운트 설정

```powershell
# Cloud Run 서비스 업데이트 (Filestore 마운트)
gcloud run services update cms-api `
  --region asia-northeast3 `
  --add-volume name=cms-db-filestore,type=cloud-storage-fuse,instance=cms-db-filestore,location=asia-northeast3-a `
  --add-volume-mount volume=cms-db-filestore,mount-path=/app/data
```

**참고**: Filestore는 Cloud Run에서 직접 마운트가 제한적일 수 있습니다. 대신 Cloud Storage FUSE를 권장합니다.

### 방법 3: 환경변수만 설정 (임시 해결책)

영구 볼륨 마운트 없이 환경변수만 설정하면, 현재 인스턴스 내에서만 DB가 유지됩니다.

```powershell
# SQLITE_DB_PATH 환경변수 설정
gcloud run services update cms-api `
  --region asia-northeast3 `
  --update-env-vars "SQLITE_DB_PATH=/app/data/cms.db"
```

**주의**: 이 방법은 인스턴스 재시작 시 DB가 초기화될 수 있습니다. 영구 저장소를 사용하는 것을 권장합니다.

## ✅ 배포 및 확인

### 1. 코드 배포

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"

# Cloud Run에 배포
gcloud run deploy cms-api `
  --source . `
  --region asia-northeast3 `
  --platform managed `
  --allow-unauthenticated `
  --port 8080
```

### 2. 환경변수 설정

```powershell
# SQLITE_DB_PATH 환경변수 설정
gcloud run services update cms-api `
  --region asia-northeast3 `
  --update-env-vars "SQLITE_DB_PATH=/app/data/cms.db"
```

### 3. 로그 확인

```powershell
# 서버 시작 로그 확인
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=cms-api AND textPayload=~'Using SQLite DB Path'" --limit 5 --format json
```

**예상 로그:**
```
Using SQLite DB Path: /app/data/cms.db
[DB] 디렉터리 생성: /app/data
[DB] ✅ SQLite 데이터베이스 연결 성공
```

### 4. DB 파일 확인 (Cloud Storage FUSE 사용 시)

```powershell
# Cloud Storage 버킷에 DB 파일이 생성되었는지 확인
gsutil ls -l gs://cms-api-db-storage/cms.db
```

## 🔍 문제 해결

### 문제 1: 디렉터리 생성 실패

**증상**: `[DB] 디렉터리 생성: /app/data` 로그가 나오지만 DB 연결 실패

**원인**: Cloud Run의 파일시스템 권한 문제

**해결책**:
1. 영구 볼륨 마운트 확인
2. 환경변수 `SQLITE_DB_PATH`가 올바르게 설정되었는지 확인

### 문제 2: DB 파일이 사라짐

**증상**: 어제 등록한 영상이 오늘 사라짐

**원인**: 영구 볼륨이 마운트되지 않아 ephemeral 파일시스템 사용

**해결책**:
1. Cloud Storage FUSE 또는 Filestore 마운트 설정
2. `SQLITE_DB_PATH` 환경변수가 영구 볼륨 경로를 가리키는지 확인

### 문제 3: 볼륨 마운트 실패

**증상**: Cloud Run 서비스 시작 실패

**원인**: 볼륨 마운트 설정 오류

**해결책**:
1. Cloud Storage 버킷이 올바르게 생성되었는지 확인
2. 서비스 계정에 Storage 권한이 있는지 확인:
   ```powershell
   gcloud projects add-iam-policy-binding esoteric-throne-471613-j6 `
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" `
     --role="roles/storage.objectAdmin"
   ```

## 📝 체크리스트

배포 전:
- [ ] 코드 빌드 성공 (`npm run build`)
- [ ] 로컬에서 `SQLITE_DB_PATH` 환경변수 테스트

배포 중:
- [ ] Cloud Storage 버킷 생성 (또는 Filestore 인스턴스 생성)
- [ ] Cloud Run 서비스에 볼륨 마운트 설정
- [ ] `SQLITE_DB_PATH` 환경변수 설정

배포 후:
- [ ] 로그에서 "Using SQLite DB Path: /app/data/cms.db" 확인
- [ ] DB 파일이 영구 저장소에 생성되었는지 확인
- [ ] 영상 등록 후 인스턴스 재시작해도 데이터 유지 확인

## 🔗 참고 자료

- [Cloud Run 볼륨 마운트](https://cloud.google.com/run/docs/configuring/volumes)
- [Cloud Storage FUSE](https://cloud.google.com/storage/docs/gcs-fuse)
- [Filestore](https://cloud.google.com/filestore/docs)












