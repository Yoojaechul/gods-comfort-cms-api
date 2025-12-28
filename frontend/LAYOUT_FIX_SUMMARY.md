# Creator My Videos 레이아웃 수정 완료

## 문제점
프로덕션(Firebase Hosting)에서만 발생하는 레이아웃 문제:
- 썸네일이 과도하게 커짐
- 오른쪽 컬럼 헤더가 한 글자씩 줄바꿈됨 ("제/언/플랫폼/...")
- 개발 환경에서는 정상, 프로덕션에서만 문제

## 원인 분석
1. **Tailwind CSS Purge 문제**: 프로덕션 빌드에서 사용되지 않는 클래스가 제거됨
2. **동적 클래스 사용**: 동적으로 생성되는 클래스가 빌드 시 인식되지 않음
3. **레이아웃 방어 코드 부재**: 테이블에 최소 너비와 overflow-x 설정이 없음
4. **헤더 텍스트 줄바꿈**: `white-space: nowrap`이 적용되지 않음

## 해결 방법

### 1. VideoTable 레이아웃 방어 스타일 추가

#### 테이블 컨테이너
```tsx
<div 
  className="bg-white rounded-lg shadow-sm overflow-hidden"
  style={{ overflowX: 'auto', minWidth: '1100px' }}
>
```

#### 테이블
```tsx
<table 
  className="min-w-full divide-y divide-gray-200"
  style={{ minWidth: '1100px', width: '100%' }}
>
```

#### 헤더 셀 (한 글자 줄바꿈 방지)
모든 `<th>` 요소에 `whiteSpace: 'nowrap'` 및 명시적 `width` 추가:
- 체크박스: `width: '50px'`
- 썸네일: `width: '150px'`
- 제목: `minWidth: '200px'`
- 언어: `width: '80px'`
- 플랫폼: `width: '100px'`
- 조회수: `width: '120px'`
- 영상 관리번호: `width: '150px'`
- 등록일: `width: '120px'`

#### 썸네일 크기 고정
```tsx
<td className="px-6 py-4" style={{ width: '150px' }}>
  <div
    className="relative cursor-pointer group"
    onClick={() => setPreviewVideo(video)}
    style={{
      width: '128px',
      height: '80px',
      minWidth: '128px',
      maxWidth: '128px',
      flexShrink: 0
    }}
  >
    <img
      src={getThumbnailUrl(video)}
      alt={video.title}
      className="rounded transition-transform group-hover:scale-105"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block'
      }}
    />
  </div>
</td>
```

#### 데이터 셀 (한 글자 줄바꿈 방지)
모든 데이터 `<td>` 요소에 `whiteSpace: 'nowrap'` 및 명시적 `width` 추가

### 2. CreatorMyVideosPage 컨테이너 수정

```tsx
<div style={{ overflowX: 'auto', width: '100%' }}>
  <VideoTable ... />
</div>
```

### 3. Tailwind safelist 추가

`tailwind.config.js`에 VideoTable에서 사용하는 클래스들을 safelist에 추가:

```js
safelist: [
  'w-32',
  'h-20',
  'w-full',
  'h-full',
  'object-cover',
  'rounded',
  'transition-transform',
  'group-hover:scale-105',
  'absolute',
  'inset-0',
  'bg-black',
  'bg-opacity-0',
  'group-hover:bg-opacity-20',
  'transition-opacity',
  'line-clamp-2',
],
```

## 변경된 파일

1. **`src/components/VideoTable.tsx`**
   - 테이블 컨테이너에 `overflowX: 'auto'`, `minWidth: '1100px'` 추가
   - 테이블에 `minWidth: '1100px'` 추가
   - 모든 헤더 셀에 `whiteSpace: 'nowrap'` 및 명시적 `width` 추가
   - 썸네일 컨테이너에 고정 크기 (`128px x 80px`) 적용
   - 썸네일 이미지에 `objectFit: 'cover'` 적용
   - 모든 데이터 셀에 `whiteSpace: 'nowrap'` 및 명시적 `width` 추가

2. **`src/pages/CreatorMyVideosPage.tsx`**
   - VideoTable을 감싸는 컨테이너에 `overflowX: 'auto'` 추가

3. **`tailwind.config.js`**
   - VideoTable에서 사용하는 클래스들을 safelist에 추가

## 검증 방법

### 1. 로컬 빌드 테스트
```bash
npm run build
```

빌드 성공 확인

### 2. Preview 테스트 (선택사항)
```bash
# serve 또는 preview 사용
npx serve dist
# 또는
npx vite preview
```

브라우저에서 확인:
- 테이블이 가로 스크롤 가능한지 확인
- 썸네일이 128px x 80px로 고정되어 있는지 확인
- 헤더 텍스트가 한 글자씩 줄바꿈되지 않는지 확인
- 모든 컬럼이 적절한 너비를 유지하는지 확인

### 3. Firebase 배포 테스트
```bash
npm run build
firebase deploy --only hosting
```

배포 후 `https://cms.godcomfortword.com/creator/my-videos` 접속하여 확인:
- 레이아웃이 개발 환경과 동일하게 표시되는지 확인
- 썸네일 크기가 정상인지 확인
- 헤더 텍스트가 한 글자씩 줄바꿈되지 않는지 확인
- 테이블이 가로 스크롤 가능한지 확인

## 예상 결과

### 수정 전 (프로덕션)
- 썸네일이 과도하게 커짐
- 헤더가 "제/언/플랫폼/..."처럼 한 글자씩 줄바꿈
- 레이아웃이 깨짐

### 수정 후 (프로덕션)
- 썸네일이 128px x 80px로 고정
- 헤더 텍스트가 한 줄로 표시됨
- 테이블이 최소 1100px 너비 유지
- 가로 스크롤 가능 (작은 화면에서)
- 개발 환경과 동일한 레이아웃

## 추가 개선 사항

인라인 스타일을 사용하여 Tailwind purge의 영향을 받지 않도록 했습니다. 이는 프로덕션 빌드에서도 안정적으로 동작합니다.

## 확인 사항
- ✅ 빌드 성공
- ✅ 린터 오류 없음
- ✅ 테이블 컨테이너에 overflow-x 추가
- ✅ 테이블에 min-width 추가
- ✅ 헤더에 white-space: nowrap 추가
- ✅ 썸네일 크기 고정 (128px x 80px)
- ✅ 썸네일 이미지에 object-fit: cover 적용
- ✅ Tailwind safelist 추가







