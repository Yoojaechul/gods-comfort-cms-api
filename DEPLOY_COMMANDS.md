# Firebase Hosting 배포 명령어

## 📋 사전 준비

1. **프로젝트 확인**
   ```bash
   firebase projects:list
   firebase use gods-comfort-word
   ```

2. **타겟 확인 (필요시)**
   ```bash
   firebase target:apply hosting cms gods-comfort-word-cms
   ```

## 🚀 배포 프로세스

### 1. 프론트엔드 빌드

```bash
cd frontend
npm install
npm run build
```

빌드 결과는 `frontend/dist/` 디렉토리에 생성됩니다.

### 2. Firebase Hosting 배포

```bash
# 루트 디렉토리에서 실행
firebase deploy --only hosting:cms
```

또는 전체 배포:
```bash
firebase deploy
```

## 🔧 문제 해결

### "Hosting site or target cms not detected" 오류

이 오류가 발생하면 다음을 시도하세요:

1. **타겟 재설정**
   ```bash
   firebase target:apply hosting cms gods-comfort-word-cms
   ```

2. **firebase.json 확인**
   - `hosting`이 객체 형식인지 확인 (배열이 아님)
   - `target: "cms"`가 설정되어 있는지 확인

3. **.firebaserc 확인**
   - 타겟 매핑이 올바른지 확인:
   ```json
   {
     "targets": {
       "gods-comfort-word": {
         "hosting": {
           "cms": ["gods-comfort-word-cms"]
         }
       }
     }
   }
   ```

### SPA 라우팅이 작동하지 않는 경우

1. `firebase.json`의 rewrites 순서 확인
2. `**` 패턴이 마지막에 있어야 함 (SPA fallback)
3. 배포 후 브라우저 캐시 클리어

## ✅ 배포 확인

배포 후 다음 URL들이 작동하는지 확인:

- https://cms.godcomfortword.com/ - 메인 페이지
- https://cms.godcomfortword.com/login - 로그인 페이지
- https://cms.godcomfortword.com/admin/videos - Admin 영상 페이지
- https://cms.godcomfortword.com/creator/my-videos - Creator 영상 페이지

API 엔드포인트:
- https://cms.godcomfortword.com/auth/login - 로그인 API
- https://cms.godcomfortword.com/creator/videos - Creator 영상 API

