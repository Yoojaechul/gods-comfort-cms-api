# MongoDB Atlas 설정 가이드

## 🚀 빠른 설정 (5분)

### 1단계: MongoDB Atlas 계정 생성
1. https://www.mongodb.com/cloud/atlas/register 접속
2. **"Sign up with Google"** 클릭
3. `consulting_manager@naver.com` Google 계정으로 가입

### 2단계: 무료 클러스터 생성
1. **"Build a Database"** 클릭
2. **"M0 (Free)"** 선택
3. Provider: **AWS**
4. Region: **Seoul (ap-northeast-2)** (가장 가까운 지역)
5. Cluster Name: **gods-cms** (기본값 그대로 OK)
6. **"Create Deployment"** 클릭

### 3단계: 데이터베이스 사용자 생성
- Username: `cmsadmin`
- Password: **자동 생성** (복사해두세요!)
- **"Create Database User"** 클릭

### 4단계: 네트워크 액세스 설정
- **"Add My Current IP Address"** 클릭
- 추가로 **"Add IP Address"** 클릭
  - IP: `0.0.0.0/0` (모든 IP 허용 - Render 서버용)
  - Description: "Render Server"
- **"Finish and Close"** 클릭

### 5단계: Connection String 가져오기
1. **"Connect"** 버튼 클릭
2. **"Drivers"** 선택
3. Driver: **Node.js**
4. Version: **6.0 or later**
5. Connection String 복사:
   ```
   mongodb+srv://cmsadmin:<password>@gods-cms.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. `<password>`를 실제 비밀번호로 교체

### 6단계: Render 환경 변수 설정
1. https://dashboard.render.com/web/srv-d4nlq4s9c44c73cvvmsg/env 접속
2. **"Add Environment Variable"** 클릭
3. Key: `MONGODB_URI`
4. Value: `mongodb+srv://cmsadmin:실제비밀번호@gods-cms.xxxxx.mongodb.net/cms?retryWrites=true&w=majority`
   - ⚠️ 마지막에 `/cms` 추가 (데이터베이스 이름)
5. **"Save Changes"** 클릭
6. **"Manual Deploy"** → **"Clear build cache & deploy"** 실행

## ✅ 완료!

이제 CMS API가 MongoDB Atlas를 사용하여 안전하게 데이터를 저장합니다!

## 🔍 확인 방법
- Render 로그에서 `✅ MongoDB connected successfully` 메시지 확인
- 웹사이트에서 Admin 로그인 테스트

## 📊 MongoDB Atlas 대시보드
- 실시간 데이터베이스 모니터링: https://cloud.mongodb.com
- Collections: `users`, `sites`, `videos`, `visits`

