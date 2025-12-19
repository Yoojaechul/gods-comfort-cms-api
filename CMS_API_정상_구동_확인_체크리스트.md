# CMS API 정상 구동 확인 체크리스트

## ✅ 확인 완료 항목

### 1. 포트 점유 상태 확인
- **포트**: `8787`
- **상태**: ✅ 정상 리스닝 중
- **PID**: 10008
- **주소**: `http://127.0.0.1:8787` 및 `http://0.0.0.0:8787`

### 2. 서버 실행 상태
- **명령어**: `npm run dev`
- **상태**: ✅ 정상 실행 중 (백그라운드)
- **로그 확인**: 
  ```
  ✅ SQLite database opened successfully
  ✅ Found 11 tables in database
  ✅ CMS API Server running on http://127.0.0.1:8787
  📊 Admin UI: http://localhost:8787/admin
  🎨 Creator UI: http://localhost:8787/creator
  ```

### 3. API 엔드포인트 테스트 결과

#### ✅ GET /health
- **URL**: `http://localhost:8787/health`
- **상태 코드**: `200 OK`
- **응답**: `{"ok":true,"time":"2025-12-14T01:59:14.931Z"}`

#### ✅ GET /public/videos
- **URL**: `http://localhost:8787/public/videos?site_id=gods&limit=10`
- **상태 코드**: `200 OK`
- **응답 크기**: 10,840 bytes
- **응답 구조**: 
  ```json
  {
    "items": [...],
    "total": ...,
    "page": 1,
    "page_size": 10,
    "cursor": "..."
  }
  ```
- **데이터 확인**: ✅ 비디오 목록 정상 반환 (YouTube, Facebook 비디오 포함)

#### ✅ POST /public/log-visit
- **URL**: `http://localhost:8787/public/log-visit`
- **상태 코드**: `200 OK`
- **요청 본문**: 
  ```json
  {
    "site_id": "gods",
    "language": "ko",
    "page_url": "/videos"
  }
  ```
- **응답**: `{"success":true,"id":"5de3e1d049f540c4b097a8193329b1e8"}`

### 4. 데이터베이스 상태
- **데이터베이스 파일**: `cms.db`
- **테이블 수**: 11개
- **상태**: ✅ 정상 연결

### 5. 환경 변수
- **.env 파일**: ✅ 존재
- **PORT**: `8787` (기본값 또는 환경변수)
- **CORS 설정**: ✅ 정상

## 📋 정확한 포트 번호

**포트**: `8787`

## 🔍 문제 해결 가이드

### ECONNREFUSED 오류 발생 시 확인 사항

1. **서버 미기동**
   - 확인: `netstat -ano | findstr :8787`
   - 해결: `npm run dev` 실행

2. **포트 불일치**
   - 확인: `.env` 파일의 `PORT` 값 확인
   - 해결: `.env`에서 `PORT=8787` 설정

3. **환경 변수 불일치**
   - 확인: `.env` 파일 존재 및 내용 확인
   - 해결: `.env.example`을 참고하여 `.env` 파일 생성

4. **CORS 오류**
   - 확인: 브라우저 콘솔에서 CORS 에러 확인
   - 해결: `.env`의 `CORS_ORIGINS`에 클라이언트 도메인 추가

## 🧪 테스트 명령어

### PowerShell에서 테스트
```powershell
# Health Check
Invoke-WebRequest -Uri "http://localhost:8787/health" -Method GET -UseBasicParsing

# Videos API
Invoke-WebRequest -Uri "http://localhost:8787/public/videos?site_id=gods&limit=10" -Method GET -UseBasicParsing

# Log Visit
$body = @{ site_id = "gods"; language = "ko"; page_url = "/videos" } | ConvertTo-Json
Invoke-WebRequest -Uri "http://localhost:8787/public/log-visit" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
```

### 브라우저에서 테스트
- Health: `http://localhost:8787/health`
- Videos: `http://localhost:8787/public/videos?site_id=gods&limit=10`

## ✅ 최종 확인

- [x] 포트 8787에서 서버 리스닝 중
- [x] GET /health → 200 OK
- [x] GET /public/videos → 200 OK (데이터 반환)
- [x] POST /public/log-visit → 200 OK
- [x] 서버가 계속 실행 중 (백그라운드)
- [x] 데이터베이스 연결 정상
- [x] CORS 설정 정상

## 📝 참고사항

- 서버는 백그라운드에서 실행 중입니다.
- 서버를 중지하려면: `Get-Process -Id 10008 | Stop-Process` (PID는 변경될 수 있음)
- 포트 충돌 시: `netstat -ano | findstr :8787`로 PID 확인 후 종료



























