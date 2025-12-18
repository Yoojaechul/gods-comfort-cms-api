function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.replace(/,/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * "실제 재생수(실제 조회수)"를 video 객체에서 추출합니다.
 *
 * 우선순위 (요청사항):
 * 1) view_count_real
 * 2) views_actual
 * 3) views_count
 * 4) 없으면 0
 *
 * 추가 호환성:
 * - camelCase 필드도 함께 지원 (viewCountReal, viewsActual, viewsCount)
 */
export function getRealPlaybackCount(video: unknown): number {
  const v = video as any;

  const candidates = [
    // 1) view_count_real
    v?.view_count_real,
    v?.viewCountReal,

    // 2) views_actual
    v?.views_actual,
    v?.viewsActual,

    // 3) views_count
    v?.views_count,
    v?.viewsCount,
  ];

  for (const c of candidates) {
    const n = toFiniteNumber(c);
    // 요구사항의 `a || b || c || 0` 의미를 그대로 따름:
    // 값이 0이면 falsy로 취급되어 다음 후보로 fallback
    if (n !== null && n > 0) return n;
  }

  return 0;
}



