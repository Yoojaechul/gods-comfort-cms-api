/**
 * 언어 코드를 영어 표기로 매핑하는 유틸 함수
 */

const languageMap: Record<string, string> = {
  // 한국어
  ko: "Korean",
  kor: "Korean",
  kr: "Korean",
  korean: "Korean",
  
  // 영어
  en: "English",
  eng: "English",
  us: "English",
  english: "English",
  
  // 일본어
  ja: "Japanese",
  jpn: "Japanese",
  jp: "Japanese",
  japanese: "Japanese",
  
  // 중국어
  zh: "Chinese",
  zho: "Chinese",
  cn: "Chinese",
  chinese: "Chinese",
  zh_cn: "Chinese (Simplified)",
  zh_tw: "Chinese (Traditional)",
  
  // 프랑스어
  fr: "French",
  fra: "French",
  french: "French",
  
  // 독일어
  de: "German",
  deu: "German",
  ger: "German",
  german: "German",
  
  // 스페인어
  es: "Spanish",
  spa: "Spanish",
  spanish: "Spanish",
  
  // 러시아어
  ru: "Russian",
  rus: "Russian",
  russian: "Russian",
  
  // 포르투갈어
  pt: "Portuguese",
  por: "Portuguese",
  portuguese: "Portuguese",
  
  // 이탈리아어
  it: "Italian",
  ita: "Italian",
  italian: "Italian",
  
  // 아랍어
  ar: "Arabic",
  ara: "Arabic",
  arabic: "Arabic",
  
  // 힌디어
  hi: "Hindi",
  hin: "Hindi",
  hindi: "Hindi",
  
  // 베트남어
  vi: "Vietnamese",
  vie: "Vietnamese",
  vietnamese: "Vietnamese",
  
  // 태국어
  th: "Thai",
  tha: "Thai",
  thai: "Thai",
  
  // 인도네시아어
  id: "Indonesian",
  ind: "Indonesian",
  indonesian: "Indonesian",
};

/**
 * 언어 코드를 영어 표기로 변환
 * @param langCode 언어 코드 (예: "ko", "en", "ja" 등)
 * @returns 영어 표기 (예: "Korean", "English", "Japanese")
 */
export function mapLanguageToEnglish(langCode: string | null | undefined): string {
  if (!langCode || typeof langCode !== "string") {
    return langCode?.toUpperCase() || "Unknown";
  }
  
  const normalized = langCode.trim().toLowerCase();
  
  // 정확히 매핑된 경우
  if (languageMap[normalized]) {
    return languageMap[normalized];
  }
  
  // 하이픈/언더스코어 제거 후 매칭 (예: "zh-CN" -> "zhcn")
  const normalizedWithoutSeparators = normalized.replace(/[-_]/g, "");
  if (languageMap[normalizedWithoutSeparators]) {
    return languageMap[normalizedWithoutSeparators];
  }
  
  // 매핑되지 않은 경우 원문을 대문자로 반환
  return langCode.trim().toUpperCase();
}











