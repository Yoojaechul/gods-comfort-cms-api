import { LANGUAGE_OPTIONS } from "../constants/languages";

/**
 * 언어 코드/값을 표시용 라벨로 변환
 * @param languageValue - 언어 코드/값 (예: "en", "ENGLISH", "English" 등)
 * @returns 표시용 라벨 (예: "English") 또는 원래 값 (매칭 실패 시)
 */
export function getLanguageLabel(languageValue: string | null | undefined): string {
  if (!languageValue) {
    return "-";
  }

  const normalized = String(languageValue).trim();
  if (normalized === "") {
    return "-";
  }

  const normalizedLower = normalized.toLowerCase();

  // 1. LANGUAGE_OPTIONS의 value와 정확히 매칭 (대소문자 무시)
  const exactMatch = LANGUAGE_OPTIONS.find(
    (option) => option.value.toLowerCase() === normalizedLower
  );
  if (exactMatch) {
    return exactMatch.label;
  }

  // 2. LANGUAGE_OPTIONS의 label과 매칭 (대소문자 무시)
  const labelMatch = LANGUAGE_OPTIONS.find(
    (option) => option.label.toLowerCase() === normalizedLower
  );
  if (labelMatch) {
    return labelMatch.label;
  }

  // 3. 일반적인 언어 코드 매핑 (예: "en" -> "ENGLISH")
  const codeMapping: Record<string, string> = {
    en: "ENGLISH",
    ko: "KOREAN",
    kr: "KOREAN",
    pt: "PORTUGUESE",
    es: "SPANISH",
    ar: "ARABIC",
    cs: "CZECH",
    zh: "CHINESE_SIMPLIFIED",
    "zh-cn": "CHINESE_SIMPLIFIED",
    "zh-tw": "CHINESE_TRADITIONAL",
    ja: "JAPANESE",
    fr: "FRENCH",
    de: "GERMAN",
    ru: "RUSSIAN",
    it: "ITALIAN",
    hi: "HINDI",
    bn: "BENGALI",
    ur: "URDU",
    ta: "TAMIL",
    te: "TELUGU",
    mr: "MARATHI",
    gu: "GUJARATI",
    ml: "MALAYALAM",
    kn: "KANNADA",
    tr: "TURKISH",
    id: "INDONESIAN",
    ms: "MALAY",
    vi: "VIETNAMESE",
    th: "THAI",
    tl: "TAGALOG",
    my: "BURMESE",
    km: "KHMER",
    el: "GREEK",
    he: "HEBREW",
    fa: "PERSIAN",
    sw: "SWAHILI",
    nl: "DUTCH",
    pl: "POLISH",
    uk: "UKRAINIAN",
    ro: "ROMANIAN",
    hu: "HUNGARIAN",
    bg: "BULGARIAN",
    sr: "SERBIAN",
    hr: "CROATIAN",
    sk: "SLOVAK",
    sl: "SLOVENIAN",
    fi: "FINNISH",
    no: "NORWEGIAN",
    da: "DANISH",
    sv: "SWEDISH",
    lv: "LATVIAN",
    lt: "LITHUANIAN",
    et: "ESTONIAN",
  };

  const mappedValue = codeMapping[normalizedLower];
  if (mappedValue) {
    const mappedOption = LANGUAGE_OPTIONS.find(
      (option) => option.value === mappedValue
    );
    if (mappedOption) {
      return mappedOption.label;
    }
  }

  // 4. 부분 매칭 시도 (예: "english"가 포함된 경우)
  const partialMatch = LANGUAGE_OPTIONS.find(
    (option) =>
      option.value.toLowerCase().includes(normalizedLower) ||
      option.label.toLowerCase().includes(normalizedLower) ||
      normalizedLower.includes(option.value.toLowerCase()) ||
      normalizedLower.includes(option.label.toLowerCase())
  );
  if (partialMatch) {
    return partialMatch.label;
  }

  // 5. 매칭 실패 시 원래 값 반환
  return normalized;
}



























































