# Render 환경 변수 설정 가이드

## 🚀 MongoDB URI 설정 (필수 - 1분)

### 단계:
1. https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg/env 접속
2. 페이지를 아래로 스크롤
3. **"Add Environment Variable"** 버튼 클릭 (또는 환경 변수 테이블의 빈 행에 직접 입력)
4. 다음 정보 입력:

**Key:**
```
MONGODB_URI
```

**Value:**
```
mongodb+srv://consultingmanager_db_user:15dloRjv70605ETm@cluster0.tb0yaly.mongodb.net/cms?retryWrites=true&w=majority&appName=Cluster0
```

5. **"Save"** 버튼 클릭
6. 자동 재배포 시작 (2-3분 소요)

## ✅ 확인 방법

1. https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg/logs 접속
2. 로그에서 다음 메시지 확인:
   - `✅ MongoDB connected successfully`
   - `✅ Database indexes created successfully`
   - `✅ Admin 자동 생성 완료!`
   - `✅ Creator 자동 생성 완료!`

## 🎯 완료 후

웹사이트 접속:
- https://www.godcomfortword.com/videos?lang=ko
- Footer에서 "d" 글자 클릭 (숨겨진 Admin 로그인)
- Email: `consulting_manager@naver.com`
- Password: (비워둠 - 최초 로그인)
- 비밀번호 설정 화면에서 새 비밀번호 입력
- Admin Dashboard 접속 성공!

## 📊 MongoDB Atlas 대시보드
- 데이터 확인: https://cloud.mongodb.com/v2/692fb2ce1de1d41e3bd4430c#/clusters
- Collections: `users`, `sites`, `videos`, `visits`

