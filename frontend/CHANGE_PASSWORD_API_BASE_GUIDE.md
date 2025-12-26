# 비밀번호 변경 API Base URL 임시 옵션 가이드

## 개요

Express 서버(`api.godcomfortword.com`)가 응답 중일 때, `ChangePasswordPage`에서만 임시로 Nest 서비스(Cloud Run) URL을 사용할 수 있도록 하는 옵션입니다.

## 환경 변수 설정

### Nest 서비스로 임시 전환 (Express 응답 중일 때)

`.env.production` 파일 또는 빌드 시 환경 변수:

```env
# 기본 API base URL (다른 모든 API 요청용)
VITE_API_BASE_URL=https://api.godcomfortword.com

# 비밀번호 변경 전용 API base URL (임시 옵션)
VITE_CHANGE_PASSWORD_API_BASE=https://cms-api-388547952090.asia-northeast3.run.app
```

또는 빌드 시 직접 지정:

```bash
VITE_API_BASE_URL=https://api.godcomfortword.com \
VITE_CHANGE_PASSWORD_API_BASE=https://cms-api-388547952090.asia-northeast3.run.app \
npm run build
```

### Express 서버 복구 후 (기본 동작)

`.env.production` 파일에서 제거하거나 주석 처리:

```env
# 기본 API base URL
VITE_API_BASE_URL=https://api.godcomfortword.com

# Express 서버 복구 후 아래 줄 제거 또는 주석 처리
# VITE_CHANGE_PASSWORD_API_BASE=https://cms-api-388547952090.asia-northeast3.run.app
```

또는 빈 값으로 설정:

```env
VITE_API_BASE_URL=https://api.godcomfortword.com
VITE_CHANGE_PASSWORD_API_BASE=
```

## 동작 방식

### 우선순위

1. **`VITE_CHANGE_PASSWORD_API_BASE`가 설정되어 있으면**:
   - `ChangePasswordPage`에서 POST `/auth/change-password` 요청 시
   - 이 환경 변수의 값을 base URL로 사용
   - 예: `https://cms-api-388547952090.asia-northeast3.run.app/auth/change-password`

2. **`VITE_CHANGE_PASSWORD_API_BASE`가 없거나 비어있으면**:
   - 기본 `CMS_API_BASE` 사용 (`VITE_API_BASE_URL` 또는 `VITE_CMS_API_BASE_URL`)
   - 모든 다른 API 요청과 동일한 base URL 사용
   - 예: `https://api.godcomfortword.com/auth/change-password`

### 영향 범위

- **영향 받는 페이지**: `ChangePasswordPage`만
- **영향 받지 않는 API**: 
  - `/auth/login`
  - `/creator/videos`
  - 기타 모든 API 요청

## 코드 위치

- **설정**: `src/config.ts` - `CHANGE_PASSWORD_API_BASE` export
- **사용**: `src/pages/ChangePasswordPage.tsx` - 조건부 API base URL 사용

## 개발 환경 설정

개발 환경에서 테스트하려면 `.env.local` 파일:

```env
# 로컬 Express 서버
VITE_API_BASE_URL=http://localhost:8787

# 로컬 Nest 서버 (또는 Cloud Run Nest 서비스)
VITE_CHANGE_PASSWORD_API_BASE=http://localhost:3000
```

## 확인 방법

브라우저 개발자 도구 콘솔에서 확인:

```javascript
// 기본 API base URL
console.log(import.meta.env.VITE_API_BASE_URL);

// 비밀번호 변경 전용 API base URL (설정된 경우)
console.log(import.meta.env.VITE_CHANGE_PASSWORD_API_BASE);
```

## 주의 사항

1. **임시 옵션**: Express 서버 복구 후에는 이 환경 변수를 제거하거나 비워두어야 합니다.

2. **우선순위**: Express 서버에 `/auth/change-password`를 복구하는 것이 최우선입니다.

3. **환경 변수 형식**: `VITE_CHANGE_PASSWORD_API_BASE`는 반드시 `http://` 또는 `https://`로 시작해야 합니다.

4. **기존 구조 유지**: 다른 모든 API 요청은 기존 `CMS_API_BASE`를 계속 사용합니다.

## 예시 시나리오

### 시나리오 1: Express 서버 응답 중

```env
# .env.production
VITE_API_BASE_URL=https://api.godcomfortword.com
VITE_CHANGE_PASSWORD_API_BASE=https://cms-api-388547952090.asia-northeast3.run.app
```

**결과**:
- 로그인, 비디오 목록 등: `https://api.godcomfortword.com` 사용
- 비밀번호 변경: `https://cms-api-388547952090.asia-northeast3.run.app` 사용

### 시나리오 2: Express 서버 복구 후

```env
# .env.production
VITE_API_BASE_URL=https://api.godcomfortword.com
# VITE_CHANGE_PASSWORD_API_BASE 제거 또는 주석 처리
```

**결과**:
- 모든 API 요청(비밀번호 변경 포함): `https://api.godcomfortword.com` 사용

## 문제 해결

### 문제: 비밀번호 변경이 여전히 Express 서버로 가는 경우

1. 환경 변수 설정 확인:
   ```bash
   echo $VITE_CHANGE_PASSWORD_API_BASE
   ```

2. 빌드 파일 확인 (dist/assets/index-*.js):
   ```bash
   grep -r "CHANGE_PASSWORD_API_BASE" dist/
   ```

3. 빌드 재실행:
   ```bash
   npm run build
   ```

### 문제: 환경 변수가 적용되지 않는 경우

- Vite 환경 변수는 `VITE_` 접두사가 필요합니다.
- 빌드 시점에 환경 변수가 설정되어야 합니다.
- `.env.production` 파일을 사용하는 경우, 파일이 프로젝트 루트에 있어야 합니다.

