# Firebase Hosting 설정 수정 완료

## 🔧 수정 사항

### 문제점
1. **타겟 인식 오류**: "Hosting site or target cms not detected in firebase.json"
2. **SPA 라우팅 실패**: `/creator/my-videos` 같은 클라이언트 라우트가 404 반환

### 해결 방법

#### 1. firebase.json 구조 변경
- **이전**: `"hosting": [{ ... }]` (배열 형식)
- **수정**: `"hosting": { ... }` (객체 형식)
- 단일 호스팅 타겟을 사용하므로 객체 형식이 더 적합합니다.

#### 2. Static Assets 헤더 추가
- `/assets/**` 경로에 캐시 헤더 추가
- 정적 파일 성능 최적화

---

## 📁 수정된 파일

### firebase.json

**변경 사항**:
- `hosting` 배열 → 객체로 변경
- `target: "cms"` 유지
- `public: "frontend/dist"` 유지
- SPA fallback (`** → /index.html`) 유지
- Static assets 캐시 헤더 추가

**최종 구조**:
```json
{
  "hosting": {
    "target": "cms",
    "public": "frontend/dist",
    "rewrites": [
      { "source": "/auth/**", "run": { ... } },
      { "source": "/creator/videos", "run": { ... } },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [
          { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
        ]
      }
    ]
  }
}
```

### .firebaserc

변경 없음 (이미 올바르게 설정됨)

---

## 🚀 배포 명령어

### 1. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

### 2. Firebase Hosting 배포

```bash
# 루트 디렉토리에서
firebase deploy --only hosting:cms
```

**또는 타겟을 명시적으로 재설정한 후 배포:**

```bash
# 타겟 재설정 (필요시)
firebase target:apply hosting cms gods-comfort-word-cms

# 배포
firebase deploy --only hosting:cms
```

---

## 🔍 라우팅 동작

### API 엔드포인트 (Cloud Functions로 프록시)

- `/auth/**` → 백엔드 API
  - 예: `/auth/login`, `/auth/check-email`, `/auth/change-password`

- `/creator/videos` → 백엔드 API (GET 요청)
  - 예: `GET /creator/videos`

### 클라이언트 사이드 라우트 (SPA Fallback)

다음 경로들은 모두 `/index.html`로 fallback되어 React Router가 처리합니다:

- `/` → 메인 페이지
- `/login` → 로그인 페이지
- `/change-password` → 비밀번호 변경 페이지
- `/admin/**` → Admin 관련 페이지
  - `/admin/videos`
  - `/admin/creators`
  - `/admin/settings`
  - 등등
- `/creator/my-videos` → Creator 영상 관리 페이지
- 기타 모든 경로

---

## ✅ 확인 사항

배포 후 다음을 확인하세요:

1. **SPA 라우팅**
   - ✅ https://cms.godcomfortword.com/creator/my-videos 접속 시 404가 아닌 페이지가 로드됨
   - ✅ https://cms.godcomfortword.com/admin/videos 접속 시 정상 작동
   - ✅ https://cms.godcomfortword.com/login 접속 시 정상 작동

2. **API 엔드포인트**
   - ✅ https://cms.godcomfortword.com/auth/login → API로 프록시됨
   - ✅ https://cms.godcomfortword.com/creator/videos → API로 프록시됨

3. **Static Assets**
   - ✅ `/assets/**` 경로의 파일들이 정상적으로 로드됨
   - ✅ 캐시 헤더가 적용됨

---

## 📝 주의사항

1. **배포 전 빌드 확인**
   - `frontend/dist/index.html` 파일이 존재하는지 확인
   - `frontend/dist/assets/` 디렉토리에 정적 파일이 있는지 확인

2. **타겟 설정**
   - `.firebaserc`에 타겟 매핑이 올바른지 확인
   - `firebase target:apply hosting cms gods-comfort-word-cms` 명령어로 재설정 가능

3. **브라우저 캐시**
   - 배포 후 브라우저 캐시를 클리어하거나 시크릿 모드로 테스트

---

## 🔄 문제 해결

### "Hosting site or target cms not detected" 오류가 계속 발생하는 경우

1. **Firebase CLI 버전 확인**
   ```bash
   firebase --version
   ```

2. **타겟 재설정**
   ```bash
   firebase target:apply hosting cms gods-comfort-word-cms
   ```

3. **firebase.json 검증**
   ```bash
   firebase deploy --only hosting:cms --dry-run
   ```

4. **Firebase 프로젝트 확인**
   ```bash
   firebase projects:list
   firebase use gods-comfort-word
   ```

### SPA 라우팅이 여전히 작동하지 않는 경우

1. **rewrites 순서 확인**
   - `**` 패턴이 마지막에 있어야 함
   - API 엔드포인트가 먼저 매칭되어야 함

2. **빌드 결과 확인**
   - `frontend/dist/index.html` 파일 확인
   - React Router가 설정되어 있는지 확인

3. **브라우저 개발자 도구 확인**
   - Network 탭에서 요청 상태 확인
   - Console에서 에러 메시지 확인







