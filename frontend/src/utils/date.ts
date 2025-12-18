/**
 * 날짜 포맷팅 유틸리티
 * 모든 날짜는 Asia/Seoul(KST) 기준으로 표시
 */

/**
 * 날짜를 KST 기준으로 'YYYY.MM.DD HH:mm' 형식으로 포맷팅
 * @param date - ISO 문자열, Date 객체, 또는 기타 날짜 형식
 * @returns 포맷팅된 날짜 문자열 (예: "2025.12.13 08:58")
 */
export function formatDateTimeKST(date: string | Date | undefined | null): string {
  if (!date) return "날짜 없음";
  
  try {
    let dateObj: Date;
    
    if (typeof date === "string") {
      // 문자열인 경우: ISO 형식인지, 일반 형식인지 확인
      // 서버에서 "2025-12-12 23:58:37" 형식으로 오는 경우, 이것이 UTC인지 로컬인지 확인 필요
      // 로그를 보면 "2025-12-12 23:58:37"이 UTC로 해석되어 "2025-12-12T14:58:37.000Z"가 됨
      // 이는 서버가 UTC로 저장했다는 의미
      
      if (date.includes("T") || date.includes("Z") || date.match(/[+-]\d{2}:\d{2}$/)) {
        // ISO 형식 (예: "2025-12-12T23:58:37Z" 또는 "2025-12-12T23:58:37+09:00")
        dateObj = new Date(date);
      } else if (date.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        // "YYYY-MM-DD HH:mm:ss" 형식인 경우 UTC로 해석
        // 예: "2025-12-12 23:58:37" -> UTC로 해석하여 KST로 변환
        // UTC로 명시적으로 파싱: "2025-12-12T23:58:37Z"
        dateObj = new Date(date.replace(" ", "T") + "Z");
      } else {
        // 기타 형식은 기본 파싱
        dateObj = new Date(date);
      }
    } else {
      dateObj = date;
    }
    
    // 유효하지 않은 날짜인지 확인
    if (isNaN(dateObj.getTime())) {
      return "날짜 없음";
    }
    
    // Intl.DateTimeFormat을 사용하여 KST 기준으로 포맷팅
    const formatter = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    
    const parts = formatter.formatToParts(dateObj);
    const year = parts.find((p) => p.type === "year")?.value || "";
    const month = parts.find((p) => p.type === "month")?.value || "";
    const day = parts.find((p) => p.type === "day")?.value || "";
    const hour = parts.find((p) => p.type === "hour")?.value || "";
    const minute = parts.find((p) => p.type === "minute")?.value || "";
    
    const formatted = `${year}.${month}.${day} ${hour}:${minute}`;
    
    return formatted;
  } catch (error) {
    console.error("날짜 포맷팅 오류:", error);
    return "날짜 없음";
  }
}

