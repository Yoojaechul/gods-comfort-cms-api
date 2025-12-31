style: Make VideoTable more compact with centered title column and improved spacing

## 변경 사항

### 1. 제목 컬럼 중앙정렬
- 제목 컬럼을 좌측 정렬에서 중앙정렬로 변경
- CSS와 인라인 스타일로 강제 적용

### 2. 테이블 간격 최적화 (컴팩트 레이아웃)
- th, td padding: 0.75rem 1rem → 8px 6px
- line-height: 1.2로 행 높이 축소
- 썸네일 크기: 120x68px → 96x54px
- 폰트 크기: 전체적으로 13px로 축소 (기존 14px/12px → 13px)
- 버튼 padding 및 폰트 크기 축소

### 3. 컬럼 폭 최적화
- 체크박스: 50px → 44px
- 관리번호: 140px → 120px (2줄 헤더 유지)
- 썸네일: 120px 유지 (내부 이미지는 96px)
- 제목: 유동 너비, 중앙정렬 + 1줄 ellipsis
- 언어: 100px → 90px
- 플랫폼: 100px → 90px
- 조회수: 100px → 70px
- 미리보기/수정/삭제: 100px/80px → 각 90px

### 4. management_id 디버깅 개선
- 개발 모드에서 첫 번째 video 객체의 키들을 console.log로 출력
- management_id와 managementId 값을 별도로 로깅
- null/undefined 체크 로직 개선

### 5. CSS 구조 정리
- 테이블 기본 font-size: 13px
- 모든 td 기본 text-align: center (제목 포함)
- 제목 셀에 명시적 중앙정렬 적용
- line-height 1.2로 통일

## 수정된 파일

- `src/components/VideoTable.tsx`: management_id 디버깅 로그 추가, 제목 중앙정렬
- `src/components/VideoTable.css`: 컴팩트 레이아웃, 컬럼 폭 최적화, 폰트 크기 축소

## 테스트 결과

- ✅ 로컬 빌드 성공 (npm run build)
- ✅ 린터 오류 없음
- ✅ CSS 파일 포함 확인 (25.26 kB)









