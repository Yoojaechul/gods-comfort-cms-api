# 🚀 CMS API 빠른 시작 가이드

## 📊 현재 상태
- ✅ 코드는 MongoDB용으로 완전히 준비됨
- ✅ GitHub에 푸시 완료
- ⏳ MongoDB Atlas 연결 문자열만 필요

## 🎯 5분 안에 완료하는 방법

### 1단계: MongoDB Atlas 클러스터 정보 확인 (1분)
1. https://cloud.mongodb.com/v2/692fb2ce1de1d41e3bd4430c#/clusters 접속
2. **"Cluster0"**가 보이면 **"Connect"** 버튼 클릭
3. **"Drivers"** 선택
4. Driver: **Node.js**, Version: **6.7 or later** 확인
5. **Connection String** 복사:
   ```
   mongodb+srv://consulting_manager:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```

### 2단계: Database User 생성 (1분)
**만약 아직 생성되지 않았다면:**
1. 왼쪽 메뉴에서 **"Database Access"** 클릭
2. **"Add New Database User"** 클릭
3. Username: `cmsadmin`
4. Password: **Auto-generate** (복사하세요!)
5. Database User Privileges: **"Atlas admin"** 선택
6. **"Add User"** 클릭

### 3단계: Network Access 설정 (1분)
1. 왼쪽 메뉴에서 **"Network Access"** 클릭
2. **"Add IP Address"** 클릭
3. **"Allow Access from Anywhere"** 클릭 (또는 `0.0.0.0/0` 입력)
4. Description: "Render Server"
5. **"Confirm"** 클릭

### 4단계: Render 환경 변수 설정 (1분)
1. https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg/env 접속
2. 환경 변수 추가:
   - **Key:** `MONGODB_URI`
   - **Value:** `mongodb+srv://cmsadmin:실제비밀번호@cluster0.xxxxx.mongodb.net/cms?retryWrites=true&w=majority`
     - ⚠️ `<password>`를 실제 비밀번호로 교체
     - ⚠️ 마지막에 `/cms` 추가 (데이터베이스 이름)
3. **"Save"** 클릭

### 5단계: Render 재배포 (1분)
1. https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg 접속
2. **"Manual Deploy"** 클릭
3. **"Clear build cache & deploy"** 선택
4. 배포 완료 대기 (2-3분)

## ✅ 완료 확인

### Render 로그 확인
https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg/logs

다음 메시지가 보이면 성공:
```
✅ MongoDB connected successfully
✅ Database indexes created successfully
====
✅ Admin 자동 생성 완료!
이메일: consulting_manager@naver.com
====
✅ Creator 자동 생성 완료!
초기 ID: 01023942042
```

### 웹사이트 테스트
1. https://www.godcomfortword.com/videos?lang=ko 접속
2. 페이지 하단 Footer에서 "reserved" 끝의 **"d"** 클릭
3. Admin 로그인:
   - 이메일: `consulting_manager@naver.com`
   - 비밀번호: (빈칸으로 두고 로그인)
4. 최초 설정에서 새 비밀번호 입력
5. CMS Admin 대시보드 접속 성공!

## 🔧 문제 해결

### "MONGODB_URI not configured" 오류
- Render 환경 변수에 `MONGODB_URI`가 설정되었는지 확인
- 배포 후 서비스가 재시작되었는지 확인

### "Authentication failed" 오류
- MongoDB Connection String의 비밀번호가 정확한지 확인
- URL encoding 필요 시: `@` → `%40`, `!` → `%21`

### 연결 문자열 예시
```
mongodb+srv://cmsadmin:MyP%40ssw0rd@cluster0.abcde.mongodb.net/cms?retryWrites=true&w=majority
```

## 📞 MongoDB Atlas 대시보드
- 메인: https://cloud.mongodb.com
- Collections 보기: Database → Data Explorer
- 사용량 모니터링: Clusters → View Monitoring































































