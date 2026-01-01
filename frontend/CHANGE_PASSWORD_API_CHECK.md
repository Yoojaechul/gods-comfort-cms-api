# 비밀번호 변경 API 요청 확인 리포트

## 확인 일시
2024년 (현재)

## 확인 대상
`src/pages/ChangePasswordPage.tsx`의 POST `/auth/change-password` 요청

---

## ✅ 확인 사항 1: API 요청 URL

### 확인 결과: ✅ 정상

**코드 위치**: `src/pages/ChangePasswordPage.tsx:67`

```67:67:src/pages/ChangePasswordPage.tsx
      const result = await apiPost("/auth/change-password", payload);
```

- ✅ 요청 경로: `/auth/change-password`
- ✅ HTTP 메서드: `POST` (apiPost 함수 사용)
- ✅ 상대 경로 사용 (절대 URL 아님)

---

## ✅ 확인 사항 2: baseURL 설정

### 확인 결과: ✅ 정상 (환경 변수 설정 필요)

**코드 흐름**:
1. `ChangePasswordPage.tsx` → `apiPost()` 호출
2. `apiClient.ts` → `apiRequest()` 호출
3. `apiClient.ts` → `buildUrl(CMS_API_BASE, path)` 사용
4. `config.ts` → `CMS_API_BASE`는 환경 변수에서 로드

**환경 변수 우선순위**:
```typescript
// src/config.ts:17
const apiBase = env.VITE_CMS_API_BASE_URL || env.VITE_API_BASE_URL || "";
```

- ✅ `VITE_CMS_API_BASE_URL` (우선)
- ✅ `VITE_API_BASE_URL` (차선)
- ⚠️ 환경 변수가 없으면 빈 문자열 (런타임 에러 발생)

**baseURL 검증 로직**:
```typescript
// src/config.ts:34-42
if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
  // 에러 처리
}
```

- ✅ 절대 URL 형식 검증 (`http://` 또는 `https://`로 시작)
- ✅ SPA 호스팅 도메인 차단 (`cms.godcomfortword.com` 방지)
- ✅ 프로덕션 환경에서 별도 API 서버 도메인 필수

**최종 요청 URL 구성**:
```
{CMS_API_BASE}/auth/change-password
```

**예시** (환경 변수 설정 시):
- `VITE_API_BASE_URL=https://api.godcomfortword.com`
- 최종 URL: `https://api.godcomfortword.com/auth/change-password`

---

## ⚠️ 확인 사항 3: 요청 필드명

### 확인 결과: ⚠️ 백엔드 DTO와 일치 여부 확인 필요

**현재 프론트엔드 필드명** (`src/pages/ChangePasswordPage.tsx:61-65`):

```61:65:src/pages/ChangePasswordPage.tsx
      const payload = {
        email: email.trim(),
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      };
```

**필드명**:
- ✅ `email` (string)
- ✅ `currentPassword` (string)
- ✅ `newPassword` (string)

**형식**: camelCase (JavaScript/TypeScript 관례)

### 백엔드 DTO 확인 필요

백엔드가 다음 중 어떤 형식을 사용하는지 확인 필요:

**옵션 1: camelCase (현재 프론트엔드와 일치)**
```json
{
  "email": "user@example.com",
  "currentPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

**옵션 2: snake_case (변경 필요 시)**
```json
{
  "email": "user@example.com",
  "current_password": "oldpass123",
  "new_password": "newpass123"
}
```

**옵션 3: 다른 필드명**
- `oldPassword` 대신 `currentPassword`?
- `password` 대신 `newPassword`?

### 권장 사항

1. **백엔드 코드 확인**:
   - 백엔드의 `/auth/change-password` 엔드포인트 DTO 확인
   - 필드명이 `email`, `currentPassword`, `newPassword`인지 확인

2. **일치하지 않는 경우**:
   - 백엔드 DTO 필드명에 맞춰 프론트엔드 payload 수정
   - 예: `currentPassword` → `current_password` (snake_case인 경우)

---

## 📋 요청 구성 상세

### 전체 요청 구조

```typescript
// 요청 URL
POST {CMS_API_BASE}/auth/change-password

// 요청 헤더
Content-Type: application/json
Authorization: Bearer {token}  // localStorage에서 가져옴

// 요청 본문
{
  "email": "user@example.com",
  "currentPassword": "oldpass123",
  "newPassword": "newpass123"
}
```

### 인증 토큰

```typescript
// src/lib/apiClient.ts:70
const token = localStorage.getItem("cms_token");
```

- ✅ 토큰이 있으면 `Authorization: Bearer {token}` 헤더 자동 추가
- ✅ 토큰이 없으면 헤더 없이 요청 (일부 API는 토큰 불필요)

---

## 🔍 환경 변수 설정 확인 방법

### 개발 환경

`.env.local` 또는 `.env` 파일:
```env
VITE_API_BASE_URL=http://localhost:8787
```

또는:
```env
VITE_CMS_API_BASE_URL=http://localhost:8787
```

### 프로덕션 빌드

`.env.production` 파일:
```env
VITE_API_BASE_URL=https://api.godcomfortword.com
```

또는 빌드 시 환경 변수 지정:
```bash
VITE_API_BASE_URL=https://api.godcomfortword.com npm run build
```

### 런타임 확인

브라우저 콘솔에서 확인:
```javascript
console.log(import.meta.env.VITE_API_BASE_URL);
console.log(import.meta.env.VITE_CMS_API_BASE_URL);
```

---

## ✅ 종합 평가

| 확인 사항 | 상태 | 비고 |
|---------|------|------|
| API 요청 URL (`/auth/change-password`) | ✅ 정상 | 상대 경로 사용, POST 메서드 |
| baseURL 설정 | ✅ 정상 | 환경 변수 기반, 검증 로직 포함 |
| 필드명 일치 여부 | ⚠️ 확인 필요 | 백엔드 DTO와 일치 여부 확인 필요 |

---

## 🎯 다음 단계

1. **백엔드 DTO 확인**:
   - `/auth/change-password` 엔드포인트의 요청 DTO 필드명 확인
   - `email`, `currentPassword`, `newPassword`가 맞는지 확인

2. **필드명 불일치 시 수정**:
   - 백엔드가 `current_password`, `new_password` (snake_case)를 사용하는 경우
   - `src/pages/ChangePasswordPage.tsx:61-65`의 payload 수정

3. **환경 변수 설정 확인**:
   - 프로덕션 빌드 시 `VITE_API_BASE_URL=https://api.godcomfortword.com` 설정 확인
   - 빌드된 파일에서 실제 baseURL 확인

---

## 📝 참고 사항

- 프론트엔드 코드는 `apiClient.ts`를 통해 모든 API 요청을 중앙화하여 관리
- HTML 응답 감지 로직이 포함되어 있어 잘못된 baseURL 설정 시 명확한 에러 메시지 제공
- SPA 호스팅 도메인(`cms.godcomfortword.com`)을 API baseURL로 사용하는 것을 방지하는 검증 로직 포함



















