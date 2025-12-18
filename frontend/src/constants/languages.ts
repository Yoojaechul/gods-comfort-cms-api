/**
 * CMS에서 사용하는 언어 옵션 목록
 * 
 * 홈페이지에서 지원하는 전체 언어 목록(약 50개)
 * 
 * 구조:
 * - value: 언어 코드 (예: 'ENGLISH', 'KOREAN')
 * - label: 표시 이름 (예: 'English', '한국어 (Korean)')
 */

export interface LanguageOption {
  value: string;
  label: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: "ENGLISH", label: "English" },
  { value: "KOREAN", label: "한국어 (Korean)" },
  { value: "PORTUGUESE", label: "Português (Portuguese)" },
  { value: "SPANISH", label: "Español (Spanish)" },
  { value: "ARABIC", label: "العربية (Arabic)" },
  { value: "CZECH", label: "Čeština (Czech)" },

  { value: "CHINESE_SIMPLIFIED", label: "简体中文 (Chinese Simplified)" },
  { value: "CHINESE_TRADITIONAL", label: "繁體中文 (Chinese Traditional)" },
  { value: "JAPANESE", label: "日本語 (Japanese)" },
  { value: "FRENCH", label: "Français (French)" },
  { value: "GERMAN", label: "Deutsch (German)" },
  { value: "RUSSIAN", label: "Русский (Russian)" },
  { value: "ITALIAN", label: "Italiano (Italian)" },

  { value: "HINDI", label: "हिन्दी (Hindi)" },
  { value: "BENGALI", label: "বাংলা (Bengali)" },
  { value: "URDU", label: "اردو (Urdu)" },
  { value: "TAMIL", label: "தமிழ் (Tamil)" },
  { value: "TELUGU", label: "తెలుగు (Telugu)" },
  { value: "MARATHI", label: "मराठी (Marathi)" },
  { value: "GUJARATI", label: "ગુજરાતી (Gujarati)" },
  { value: "MALAYALAM", label: "മലയാളം (Malayalam)" },
  { value: "KANNADA", label: "ಕನ್ನಡ (Kannada)" },

  { value: "TURKISH", label: "Türkçe (Turkish)" },
  { value: "INDONESIAN", label: "Bahasa Indonesia" },
  { value: "MALAY", label: "Bahasa Melayu (Malay)" },
  { value: "VIETNAMESE", label: "Tiếng Việt (Vietnamese)" },
  { value: "THAI", label: "ไทย (Thai)" },
  { value: "TAGALOG", label: "Tagalog / Filipino" },
  { value: "BURMESE", label: "မြန်မာစာ (Burmese)" },
  { value: "KHMER", label: "ខ្មែរ (Khmer)" },

  { value: "GREEK", label: "Ελληνικά (Greek)" },
  { value: "HEBREW", label: "עברית (Hebrew)" },
  { value: "PERSIAN", label: "فارسی (Persian)" },
  { value: "SWAHILI", label: "Kiswahili (Swahili)" },

  { value: "DUTCH", label: "Nederlands (Dutch)" },
  { value: "POLISH", label: "Polski (Polish)" },
  { value: "UKRAINIAN", label: "Українська (Ukrainian)" },
  { value: "ROMANIAN", label: "Română (Romanian)" },
  { value: "HUNGARIAN", label: "Magyar (Hungarian)" },
  { value: "BULGARIAN", label: "Български (Bulgarian)" },
  { value: "SERBIAN", label: "Српски (Serbian)" },
  { value: "CROATIAN", label: "Hrvatski (Croatian)" },
  { value: "SLOVAK", label: "Slovenčina (Slovak)" },
  { value: "SLOVENIAN", label: "Slovenščina (Slovenian)" },

  { value: "FINNISH", label: "Suomi (Finnish)" },
  { value: "NORWEGIAN", label: "Norsk (Norwegian)" },
  { value: "DANISH", label: "Dansk (Danish)" },
  { value: "SWEDISH", label: "Svenska (Swedish)" },

  { value: "LATVIAN", label: "Latviešu (Latvian)" },
  { value: "LITHUANIAN", label: "Lietuvių (Lithuanian)" },
  { value: "ESTONIAN", label: "Eesti (Estonian)" }
];

/**
 * 언어 코드로 언어 옵션 찾기
 */
export function getLanguageOption(value: string): LanguageOption | undefined {
  return LANGUAGE_OPTIONS.find(option => option.value === value);
}

/**
 * 기본 언어 코드 (영어)
 */
export const DEFAULT_LANGUAGE = 'ENGLISH';

