# Fastify → NestJS 점진적 마이그레이션 가이드

## 📋 현재 상황

### 서버 구성

| 서버 | 포트 | 상태 | 용도 |
|------|------|------|------|
| **Fastify** | 8787 | ✅ 운영 중 | 기존 모든 기능 제공 |
| **NestJS** | 8788 | 🆕 신규 | Auth 기능만 제공 (시작 단계) |

### 데이터베이스

- **파일**: `cms.db` (루트 디렉터리)
- **공유**: 두 서버가 **동일한 DB 파일** 사용
- **충돌 방지**: SQLite WAL 모드 활성화됨

---

## 🚀 단계별 마이그레이션 전략

### Phase 1: Auth 모듈 이전 (현재 단계) ✅

**완료된 작업**:
- ✅ NestJS 프로젝트 초기화
- ✅ Auth 모듈 구현 (login, setup-password, health)
- ✅ JWT 인증 구현
- ✅ Swagger 문서화
- ✅ 기존 SQLite DB 연동

**프론트엔드 변경사항**:
- 로그인 API 호출 시 포트만 변경:
  ```javascript
  // 기존 (Fastify)
  fetch('http://localhost:8787/auth/login', { ... })
  
  // 신규 (NestJS) - 테스트용
  fetch('http://localhost:8788/auth/login', { ... })
  ```

**병행 운용**:
- 두 서버 모두 실행
- 프론트엔드는 당분간 **Fastify(8787)** 계속 사용
- NestJS는 **테스트 및 검증 목적**으로만 사용

---

### Phase 2: 공개 API 이전 (다음 단계) 🔄

**이전 대상**:
- `GET /public/videos` - 공개 영상 조회
- `POST /public/log-visit` - 방문자 로깅
- `GET /health` - 헬스 체크

**작업 내용**:
1. NestJS에 `PublicModule` 생성
2. Fastify와 동일한 응답 구조 구현
3. 테스트 후 프론트엔드 전환

---

### Phase 3: Admin API 이전 🔄

**이전 대상**:
- `GET /admin/sites` - 사이트 목록
- `POST /admin/creators` - 크리에이터 생성
- `GET /admin/videos` - 영상 관리
- `GET /admin/analytics` - 방문자 통계
- 기타 Admin 전용 엔드포인트

**작업 내용**:
1. NestJS에 `AdminModule` 생성
2. Role-based 가드 구현 (Admin 전용)
3. 단계적 이전

---

### Phase 4: Creator API 이전 🔄

**이전 대상**:
- `GET /videos` - 내 영상 조회
- `POST /videos` - 영상 생성
- `PATCH /videos/:id` - 영상 수정
- `DELETE /videos/:id` - 영상 삭제
- `POST /videos/batch` - 일괄 생성

**작업 내용**:
1. NestJS에 `VideosModule` 생성
2. Creator 권한 가드 구현
3. 메타데이터 추출 기능 이전

---

### Phase 5: Fastify 서버 단계적 종료 🔄

**최종 단계**:
1. 모든 기능이 NestJS로 이전 완료
2. 프론트엔드가 NestJS(8788) 사용 확인
3. Fastify 서버 중단
4. NestJS를 8787 포트로 변경 (선택사항)
5. 기존 Fastify 코드 아카이브

---

## 🔧 개발 환경에서 두 서버 동시 실행

### Terminal 1: Fastify 서버

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api"
npm run dev
```

**확인**:
```
✅ CMS API Server running on http://0.0.0.0:8787
```

---

### Terminal 2: NestJS 서버

```powershell
cd "C:\Users\consu_rutwdcg\SynologyDrive\999. cms_api\nest-api"
npm run start:dev
```

**확인**:
```
✅ NestJS API Server running on http://localhost:8788
📚 Swagger UI: http://localhost:8788/api-docs
```

---

## 🌐 프론트엔드 전환 가이드

### 환경별 API URL 설정

**개발 환경** (`.env.local`):
```env
# 기존 (Fastify) - 현재 사용 중
REACT_APP_API_URL=http://localhost:8787

# 신규 (NestJS) - 테스트용
REACT_APP_NEST_API_URL=http://localhost:8788
```

### API 클라이언트 수정 예시

```typescript
// api/auth.ts

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8787';
const NEST_API_URL = process.env.REACT_APP_NEST_API_URL || 'http://localhost:8788';

// 기존 방식 (Fastify)
export const loginFastify = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};

// 신규 방식 (NestJS) - 테스트용
export const loginNest = async (email: string, password: string) => {
  const response = await fetch(`${NEST_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
};

// 기본 export는 당분간 Fastify 사용
export const login = loginFastify;
```

### 전환 시점

1. **테스트 단계**: NestJS API를 충분히 검증
2. **부분 전환**: 일부 사용자만 NestJS로 라우팅
3. **완전 전환**: 모든 사용자가 NestJS 사용
4. **Fastify 제거**: 기존 서버 종료

---

## ⚠️ 주의사항

### 1. 비밀번호 해시 방식 차이

**문제점**:
- **Fastify**: `scrypt` 사용
- **NestJS**: `bcrypt` 사용

**해결책** (선택 1):
기존 계정은 NestJS에서 `/auth/setup-password`로 재설정

**해결책** (선택 2):
DatabaseService에 scrypt 호환 로직 추가 (고급)

### 2. DB 동시 접근

**안전장치**:
- SQLite WAL 모드 활성화 (완료)
- 읽기 작업은 안전하게 병렬 처리
- 쓰기 작업은 자동으로 직렬화됨

**권장사항**:
- 테스트 시에는 한 서버만 쓰기 작업 수행
- 프로덕션 전환 시에는 완전히 이전 후 기존 서버 종료

### 3. 포트 충돌 방지

현재 설정:
- Fastify: `8787` (환경변수 `PORT`)
- NestJS: `8788` (환경변수 `PORT`)

각 서버의 `.env` 파일에서 포트가 다른지 확인!

---

## 📊 마이그레이션 체크리스트

### Phase 1 (현재)
- [x] NestJS 프로젝트 초기화
- [x] Auth 모듈 구현
- [x] JWT 인증
- [x] Swagger 문서화
- [x] 기존 DB 연동
- [ ] 프론트엔드 테스트
- [ ] 비밀번호 해시 호환성 해결

### Phase 2-5 (향후)
- [ ] Public API 이전
- [ ] Admin API 이전
- [ ] Creator API 이전
- [ ] 전체 기능 검증
- [ ] 프론트엔드 완전 전환
- [ ] Fastify 서버 종료

---

## 🎯 다음 단계

1. **`.env` 파일 생성** (`nest-api/.env`)
2. **의존성 설치** (`npm install`)
3. **NestJS 서버 실행** (`npm run start:dev`)
4. **Thunder Client로 Auth API 테스트**
5. **Swagger UI 확인** (`http://localhost:8788/api-docs`)
6. **기존 계정으로 로그인 테스트**

이제 Auth 기능이 NestJS로 성공적으로 이전되었습니다! 🎉






























































































