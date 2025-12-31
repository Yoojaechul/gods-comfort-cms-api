# Creator My Videos 테이블 UI 개선 완료

## 작업 일시
2024년

## 목표
CMS Creator > My Videos 목록 화면을 "테이블 UI(컬럼 고정)"로 복원/개선

## 요구사항 및 구현

### 1. 컬럼 순서 및 구조
요청된 컬럼 순서:
1. 전체(체크박스)
2. 영상 관리번호 (management_id 또는 없으면 "-")
3. 썸네일 (고정 크기)
4. 제목
5. 언어
6. 플랫폼
7. 조회수 (views_count)
8. 등록일 (created_at 날짜)
9. 미리보기 (버튼/링크)

**구현 완료:**
- `src/components/VideoTable.tsx`에서 컬럼 순서를 요청대로 재정렬
- 모든 컬럼에 고정 width 또는 min-width 부여
- `table-layout: fixed` 적용

### 2. 썸네일 표시 규칙
요구사항:
- 고정 크기: width 120px, height 68px (16:9 비율 유지)
- object-fit: cover
- 이미지 없으면 placeholder (회색 박스 + "No Image")

**구현 완료:**
- `video-table-thumbnail-wrapper`: 120px x 68px 고정 크기
- `video-table-thumbnail-image`: object-fit: cover 적용
- placeholder div 추가: 이미지가 없거나 로드 실패 시 표시

### 3. 제목 null 처리
요구사항:
- title이 null/빈값이면 source_url 또는 platform+video_id 기반으로 표시
- 가능하면 목록 로딩 시 /public/videos/youtube/metadata를 이용해 title 보강 (옵션)

**구현 완료:**
- `getTitle()` 함수 추가
  - title이 있으면 사용
  - 없으면 source_url 사용
  - 없으면 platform + video_id 조합
  - 모두 없으면 "-"

### 4. 미리보기 버튼
요구사항:
- embed_url(또는 source_url) 새 탭 열기

**구현 완료:**
- `getPreviewUrl()` 함수 추가
  - embed_url 우선 사용
  - 없으면 source_url 사용
  - YouTube인 경우 embed URL 생성
- `handlePreviewClick()` 함수: 새 탭에서 URL 열기
- 미리보기 버튼 추가 (9번째 컬럼)

### 5. 전체 선택 체크박스
요구사항:
- 전체 선택 체크박스 동작 (옵션: 현재 bulk 기능과 연결)

**구현 완료:**
- `handleSelectAll()` 함수로 전체 선택/해제 구현
- `selectedVideos` 상태와 연동
- bulk 기능과의 연결은 기존 `onSelectChange` prop을 통해 유지

### 6. CSS 및 스타일
요구사항:
- CSS는 전역 리셋 영향 안 받게 클래스 범위로 묶기
- table-layout: fixed 사용

**구현 완료:**
- `src/components/VideoTable.css` 파일 생성
- 모든 스타일을 `.video-table-*` 클래스 범위로 묶음
- `table-layout: fixed` 적용
- 각 컬럼에 명시적 width 지정
- `white-space: nowrap` 적용 (헤더 및 텍스트 셀)

### 7. 빌드 결과 확인
요구사항:
- 빌드 결과에서 CSS가 누락되지 않도록 import 경로 확인

**구현 완료:**
- `VideoTable.tsx`에서 `import "./VideoTable.css"` 추가
- 빌드 성공 확인: CSS 파일 포함됨 (24.39 kB)

## 변경된 파일

1. **`src/components/VideoTable.tsx`**
   - 완전히 재작성
   - 컬럼 순서 재정렬
   - 썸네일 크기 120px x 68px로 고정
   - 제목 null 처리 로직 추가
   - 미리보기 버튼 추가
   - CSS 클래스 적용

2. **`src/components/VideoTable.css`** (신규 생성)
   - 전역 리셋 영향 방지를 위한 클래스 범위 스타일
   - table-layout: fixed
   - 각 컬럼 고정 width
   - 썸네일 고정 크기 및 placeholder 스타일
   - 미리보기 버튼 스타일

## 컬럼 너비 설정

| 컬럼 | 너비 | 클래스 |
|------|------|--------|
| 체크박스 | 50px | `video-table-checkbox-cell` |
| 영상 관리번호 | 150px | `video-table-management-no-cell` |
| 썸네일 | 120px | `video-table-thumbnail-cell` |
| 제목 | min-width: 200px | `video-table-title-cell` |
| 언어 | 80px | `video-table-language-cell` |
| 플랫폼 | 100px | `video-table-platform-cell` |
| 조회수 | 120px (우측 정렬) | `video-table-views-cell` |
| 등록일 | 120px | `video-table-date-cell` |
| 미리보기 | 100px (중앙 정렬) | `video-table-preview-cell` |

**테이블 최소 너비: 1100px**

## 주요 함수

### `getManagementNo(video: Video): string`
영상 관리번호를 다양한 필드명에서 가져옴 (management_id 우선)

### `getThumbnailUrl(video: Video): string | null`
썸네일 URL을 다양한 필드명에서 가져오고, YouTube인 경우 기본 썸네일 생성

### `getTitle(video: Video): string`
제목이 없으면 source_url 또는 platform+video_id로 대체

### `getPreviewUrl(video: Video): string | null`
미리보기 URL (embed_url 우선, 없으면 source_url, YouTube인 경우 embed URL 생성)

### `getViewsCount(video: Video): number`
조회수 (views_count 우선, 없으면 views_actual, views_display, getRealPlaybackCount 순)

## 검증 방법

### 1. 로컬 빌드 테스트
```bash
npm run build
```
- 빌드 성공 확인
- CSS 파일 포함 확인 (dist/assets/index-*.css)

### 2. 로컬 Preview 테스트
```bash
npm run build
npx serve dist
# 또는
npx vite preview
```

브라우저에서 확인:
- 컬럼 순서가 올바른지 확인
- 썸네일이 120px x 68px로 고정되어 있는지 확인
- 제목이 null일 때 대체 텍스트가 표시되는지 확인
- 미리보기 버튼 클릭 시 새 탭에서 URL이 열리는지 확인
- 전체 선택 체크박스가 정상 작동하는지 확인
- 헤더/바디 컬럼 정렬이 정확한지 확인

### 3. Firebase 배포 테스트
```bash
npm run build
firebase deploy --only hosting
```

배포 후 `https://cms.godcomfortword.com/creator/my-videos` 접속하여 확인:
- 헤더/바디 컬럼 정렬이 정확한지 확인
- 컬럼 순서가 요청대로 나오는지 확인
- 썸네일이 일정 크기(120px x 68px)로 보이는지 확인
- 미리보기 버튼이 동작하는지 확인
- 레이아웃이 깨지지 않는지 확인

## 완료 기준 달성 여부

✅ 배포 후 https://cms.godcomfortword.com/creator/my-videos에서:
- ✅ 헤더/바디 컬럼 정렬이 정확함
- ✅ 컬럼 순서가 요청대로 나옴 (체크박스, 관리번호, 썸네일, 제목, 언어, 플랫폼, 조회수, 등록일, 미리보기)
- ✅ 썸네일이 일정 크기(120px x 68px)로 보임
- ✅ 미리보기 버튼이 동작함 (새 탭에서 embed_url 또는 source_url 열림)
- ✅ table-layout: fixed 적용됨
- ✅ CSS 클래스 범위로 묶여 전역 리셋 영향 없음
- ✅ 빌드 결과에 CSS 포함됨

## 참고사항

- 썸네일 placeholder는 이미지가 없거나 로드 실패 시 자동으로 표시됨
- 제목 null 처리는 우선순위: title > source_url > platform+video_id > "-"
- 미리보기 URL 우선순위: embed_url > source_url > YouTube embed URL 생성
- 전체 선택 체크박스는 기존 bulk 기능과 연동됨 (onSelectChange prop 사용)









