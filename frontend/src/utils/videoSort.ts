import type { Video } from "../types/video";

/**
 * 영상에서 관리번호를 추출합니다.
 * videoManageNo 필드를 최우선으로 확인하고, 기존 필드명들도 지원합니다.
 */
function getManagementNumber(video: Video): string | null {
  // videoManageNo를 최우선으로 확인 (표준 필드명, AdminVideosPage에서 정규화됨)
  const candidates = [
    (video as any).videoManageNo,  // 최우선 (표준 필드명)
    (video as any).video_manage_no,  // snake_case 버전
    (video as any).videoManagementNo,  // camelCase 버전
    (video as any).video_management_no,  // snake_case 버전
    (video as any).manageNo,
    (video as any).managementNo,
    video.managementId,
    (video as any).management_no,
    (video as any).management_id,
    (video as any).managementNumber,
    (video as any).management_code,
    (video as any).adminCode,
    (video as any).code,
    (video as any).video_code,
    (video as any).adminId,
    (video as any).admin_id,
  ];
  const found = candidates.find(v => v !== null && v !== undefined && String(v).trim() !== "");
  return found ? String(found).trim() : null;
}

/**
 * 관리번호를 정렬 가능한 숫자 키로 변환합니다.
 * 
 * 포맷 예시:
 * - YYMMDD-### (예: 241213-001)
 * - YYYYMMDD-### (예: 20241213-001)
 * - 기타 형식도 처리
 * 
 * @param managementNumber 관리번호 문자열
 * @returns 정렬 키 (숫자, 클수록 최신)
 */
function parseManagementNumberToSortKey(managementNumber: string | null): number {
  if (!managementNumber || managementNumber.trim() === "" || managementNumber === "-") {
    // 관리번호가 없으면 가장 낮은 우선순위 (0)
    return 0;
  }

  const trimmed = managementNumber.trim();
  
  // YYMMDD-### 형식 파싱 (예: 251213-010)
  // 정규식: YY(2자리) + MM(2자리) + DD(2자리) + 하이픈 + 시퀀스(3자리)
  const matchYYMMDD = trimmed.match(/^(\d{2})(\d{2})(\d{2})-(\d+)$/);
  if (matchYYMMDD) {
    const [, yearPart, month, day, sequence] = matchYYMMDD;
    
    // 연도를 4자리로 변환 (2자리면 2000년대 가정, 25 -> 2025)
    const year = 2000 + parseInt(yearPart, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const sequenceNum = parseInt(sequence, 10);
    
    // 정렬 키: YYYYMMDD * 10000 + sequence
    // 예: 251213-010 -> 20251213010
    return year * 1000000 + monthNum * 10000 + dayNum * 100 + sequenceNum;
  }
  
  // YYYYMMDD-### 형식 파싱 (예: 20251213-010)
  const matchYYYYMMDD = trimmed.match(/^(\d{4})(\d{2})(\d{2})-(\d+)$/);
  if (matchYYYYMMDD) {
    const [, yearPart, month, day, sequence] = matchYYYYMMDD;
    const year = parseInt(yearPart, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const sequenceNum = parseInt(sequence, 10);
    return year * 1000000 + monthNum * 10000 + dayNum * 100 + sequenceNum;
  }
  
  // YYMMDD 형식 (시퀀스 없음)
  const dateOnlyMatch = trimmed.match(/^(\d{2,4})(\d{2})(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearPart, month, day] = dateOnlyMatch;
    const year = yearPart.length === 2 
      ? 2000 + parseInt(yearPart, 10)
      : parseInt(yearPart, 10);
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    return year * 1000000 + monthNum * 10000 + dayNum * 100;
  }
  
  // 숫자만 있는 경우 (예: "241213001")
  const numericMatch = trimmed.match(/^(\d+)$/);
  if (numericMatch) {
    const num = parseInt(numericMatch[1], 10);
    // 6자리 이상이면 날짜 형식으로 간주
    if (num >= 100000) {
      return num;
    }
  }
  
  // 파싱 실패 시 문자열을 숫자로 변환 시도
  // 알파벳이 포함된 경우도 처리 (예: "ABC-241213-001")
  const allNumericParts = trimmed.match(/\d+/g);
  if (allNumericParts && allNumericParts.length > 0) {
    // 마지막 숫자 부분을 시퀀스로, 나머지를 날짜로 간주
    const lastPart = allNumericParts[allNumericParts.length - 1];
    const dateParts = allNumericParts.slice(0, -1).join("");
    
    if (dateParts.length >= 6) {
      const yearPart = dateParts.substring(0, dateParts.length === 6 ? 2 : 4);
      const month = dateParts.substring(yearPart.length, yearPart.length + 2);
      const day = dateParts.substring(yearPart.length + 2, yearPart.length + 4);
      
      const year = yearPart.length === 2 
        ? 2000 + parseInt(yearPart, 10)
        : parseInt(yearPart, 10);
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);
      const sequenceNum = parseInt(lastPart, 10);
      
      return year * 1000000 + monthNum * 10000 + dayNum * 100 + sequenceNum;
    }
  }
  
  // 모든 파싱 실패 시 문자열 해시를 사용 (낮은 우선순위)
  // 문자열을 숫자로 변환하여 대략적인 정렬
  let hash = 0;
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) - hash) + trimmed.charCodeAt(i);
    hash = hash & hash; // 32bit 정수로 변환
  }
  return Math.abs(hash);
}

/**
 * 영상에서 batchOrder를 추출합니다.
 */
function getBatchOrder(video: Video): number | null {
  const candidates = [
    (video as any).batchOrder,
    (video as any).batch_order,
    (video as any).order,
  ];
  const found = candidates.find(v => v !== null && v !== undefined && !isNaN(Number(v)));
  return found !== undefined ? Number(found) : null;
}

/**
 * 영상 배열을 정렬합니다.
 * 우선순위: 1) batchOrder (오름차순, 작은 값이 먼저), 2) 관리번호 (내림차순, 큰 값이 먼저), 3) createdAt (내림차순, 최신이 먼저)
 * 
 * @param videos 정렬할 영상 배열
 * @returns 정렬된 영상 배열
 */
export function sortVideosByManagementNumber(videos: Video[]): Video[] {
  if (!Array.isArray(videos) || videos.length === 0) {
    return videos;
  }
  
  return [...videos].sort((a, b) => {
    const batchOrderA = getBatchOrder(a);
    const batchOrderB = getBatchOrder(b);
    
    // batchOrder가 있는 경우 우선 정렬 (오름차순: 1, 2, 3, ...)
    if (batchOrderA !== null && batchOrderB !== null) {
      return batchOrderA - batchOrderB;
    }
    
    // 하나만 batchOrder가 있는 경우, batchOrder가 있는 것이 먼저
    if (batchOrderA !== null && batchOrderB === null) {
      return -1; // a가 먼저
    }
    if (batchOrderA === null && batchOrderB !== null) {
      return 1; // b가 먼저
    }
    
    // 둘 다 batchOrder가 없는 경우 관리번호로 정렬
    const managementA = getManagementNumber(a);
    const managementB = getManagementNumber(b);
    
    const keyA = parseManagementNumberToSortKey(managementA);
    const keyB = parseManagementNumberToSortKey(managementB);
    
    // 관리번호가 둘 다 있으면 관리번호로 정렬 (내림차순, 큰 값이 먼저)
    if (keyA > 0 && keyB > 0) {
      return keyB - keyA;
    }
    
    // 관리번호가 하나만 있으면, 관리번호가 있는 것이 먼저
    if (keyA > 0 && keyB === 0) {
      return -1; // a가 먼저
    }
    if (keyA === 0 && keyB > 0) {
      return 1; // b가 먼저
    }
    
    // 둘 다 관리번호가 없으면 createdAt으로 정렬 (내림차순, 최신이 먼저)
    const createdAtA = (a as any).createdAt || (a as any).created_at || (a as any).uploadedAt || (a as any).uploaded_at || null;
    const createdAtB = (b as any).createdAt || (b as any).created_at || (b as any).uploadedAt || (b as any).uploaded_at || null;
    
    if (createdAtA && createdAtB) {
      const dateA = new Date(createdAtA).getTime();
      const dateB = new Date(createdAtB).getTime();
      return dateB - dateA; // 내림차순 (최신이 먼저)
    }
    
    // createdAt도 없으면 원래 순서 유지
    return 0;
  });
}


