import { useState, useEffect, useRef } from "react";
import type { Video, VideoPayload } from "../../types/video";
import { useAuth } from "../../contexts/AuthContext";
import { uploadThumbnail } from "../../lib/cmsClient";
import { buildVideoPayload } from "../../utils/videoPayload";
import { getVideoApiEndpoint } from "../../lib/videoApi";
import { LANGUAGE_OPTIONS, DEFAULT_LANGUAGE } from "../../constants/languages";
import { fetchYouTubeMetadata, validateYouTubeUrl, extractYoutubeId } from "../../utils/videoMetadata";
import { apiPost } from "../../lib/apiClient";
import "./BulkVideosModal.css";

interface BulkVideoRow {
  id?: string;
  delete: boolean;
  title: string;
  sourceType: "youtube" | "facebook";
  sourceUrl: string;
  thumbnailUrl: string;
  language: string; // 언어 코드
  uploadingThumbnail?: boolean; // 썸네일 업로드 중 상태
  fetchingMetadata?: boolean; // YouTube 메타데이터 가져오는 중 상태
  error?: string; // 행별 에러 메시지
}

interface BulkVideosModalProps {
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

const MAX_ROWS = 20;
const INITIAL_ROWS = 10;
const ROWS_TO_ADD = 10;

// 빈 행 생성 함수
const createEmptyRow = (): BulkVideoRow => ({
  delete: false,
  title: "",
  sourceType: "youtube",
  sourceUrl: "",
  thumbnailUrl: "",
  language: DEFAULT_LANGUAGE, // 기본값은 영어
  uploadingThumbnail: false,
  fetchingMetadata: false,
});

// YouTube URL 검증 함수 (간단한 버전)
function isYouTubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  return /youtube\.com|youtu\.be/.test(trimmed) || /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
}

export default function BulkVideosModal({ onClose, onSuccess }: BulkVideosModalProps) {
  const { token, user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 소스 타입 일괄 변경용 상태
  const [bulkSourceType, setBulkSourceType] = useState<"youtube" | "facebook">("youtube");
  
  // 언어 일괄 변경용 상태
  const [bulkLanguage, setBulkLanguage] = useState<string>(DEFAULT_LANGUAGE);
  
  // 초기 10개 행 생성
  const [rows, setRows] = useState<BulkVideoRow[]>(() => {
    return Array.from({ length: INITIAL_ROWS }, () => createEmptyRow());
  });
  
  // 최신 rows 상태를 추적하기 위한 ref (저장 시 최신 상태 보장)
  const rowsRef = useRef<BulkVideoRow[]>(rows);
  
  // rows 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  // 행 추가 (10개씩)
  const addRows = () => {
    const currentCount = rows.length;
    const canAdd = MAX_ROWS - currentCount;
    
    if (canAdd <= 0) {
      alert(`최대 ${MAX_ROWS}개까지만 추가할 수 있습니다.`);
      return;
    }
    
    const rowsToAdd = Math.min(ROWS_TO_ADD, canAdd);
    const newRows = Array.from({ length: rowsToAdd }, () => createEmptyRow());
    
    setRows([...rows, ...newRows]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof BulkVideoRow, value: any) => {
    const newRows = [...rows];
    const oldRow = newRows[index];
    newRows[index] = {
      ...newRows[index],
      [field]: value,
      error: undefined, // 필드 변경 시 에러 초기화
    };
    
    // sourceType이 변경된 경우 처리
    if (field === "sourceType") {
      const newSourceType = value as "youtube" | "facebook";
      const oldSourceType = oldRow.sourceType;
      
      // youtube -> facebook 변경 시: title/thumbnailUrl은 유지 (사용자가 수정 가능)
      // facebook -> youtube 변경 시: URL이 있으면 메타데이터 다시 가져오기
      if (oldSourceType === "facebook" && newSourceType === "youtube" && oldRow.sourceUrl.trim()) {
        // URL이 이미 있으면 메타데이터 가져오기 (비동기)
        setTimeout(() => {
          handleSourceUrlBlur(index, oldRow.sourceUrl);
        }, 100);
      }
    }
    
    setRows(newRows);
  };
  
  // 행별 에러 설정
  const setRowError = (index: number, errorMessage: string | undefined) => {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], error: errorMessage };
      return newRows;
    });
  };

  // 소스 타입 일괄 적용
  const applyBulkSourceType = () => {
    setRows((prev) => prev.map((row) => ({ ...row, sourceType: bulkSourceType })));
  };

  // 언어 일괄 적용
  const applyBulkLanguage = () => {
    setRows((prev) => prev.map((row) => ({ ...row, language: bulkLanguage })));
  };

  // YouTube 메타데이터 가져오기 (공통 함수 사용)
  const fetchRowYouTubeMetadata = async (index: number, url: string) => {
    // 최신 rows 상태 확인
    const currentRows = rows;
      const row = currentRows[index];
      
      // YouTube가 아니거나 URL이 비어있으면 스킵
    if (row.sourceType !== "youtube" || !url.trim() || !validateYouTubeUrl(url.trim())) {
      return;
      }

        try {
          // fetchingMetadata 상태 설정
          setRows((prev) => {
            const newRows = [...prev];
            if (newRows[index].sourceType === "youtube") {
              newRows[index] = { ...newRows[index], fetchingMetadata: true };
            }
            return newRows;
          });
          
      // 공통 메타데이터 함수 사용 (실패해도 에러를 throw하지 않음)
      const metadata = await fetchYouTubeMetadata(url.trim(), token || "");
          
          // 최신 rows 상태를 다시 가져와서 확인 후 업데이트
          setRows((prev) => {
            const newRows = [...prev];
            const currentRow = newRows[index];
            
            // YouTube가 아니면 스킵
            if (currentRow.sourceType !== "youtube") {
              return prev;
            }
            
        // title이 비어있거나 URL이 변경된 경우에만 채우기 (사용자가 수정한 경우 보존)
        // URL이 변경된 경우는 항상 업데이트
        if (metadata.title) {
          // 현재 URL과 일치하는지 확인 (URL이 변경되었는지)
          const currentUrlMatches = currentRow.sourceUrl.trim() === url.trim();
          if (!currentRow.title.trim() || currentUrlMatches) {
            newRows[index] = { ...currentRow, title: metadata.title };
          }
            }
            
        // thumbnailUrl도 동일한 규칙 적용
        if (metadata.thumbnail_url) {
          const currentUrlMatches = currentRow.sourceUrl.trim() === url.trim();
          if (!currentRow.thumbnailUrl.trim() || currentUrlMatches) {
            newRows[index] = { ...newRows[index], thumbnailUrl: metadata.thumbnail_url };
          }
            }
            
            // fetchingMetadata 상태 해제
            newRows[index] = { ...newRows[index], fetchingMetadata: false };
            
            return newRows;
          });
          
      console.log(`행 ${index + 1} YouTube 메타데이터 가져오기 완료:`, { title: metadata.title, thumbnail: metadata.thumbnail_url });
        } catch (err) {
      // fetchYouTubeMetadata는 이제 에러를 throw하지 않으므로 이 블록은 실행되지 않지만, 안전을 위해 유지
      console.warn(`행 ${index + 1} YouTube 메타데이터 가져오기 실패 (무시됨):`, err);
          // fetchingMetadata 상태 해제
          setRows((prev) => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], fetchingMetadata: false };
            return newRows;
          });
        }
  };

  // 소스 URL 변경 핸들러 (onChange)
  const handleSourceUrlChange = (index: number, value: string) => {
    updateRow(index, "sourceUrl", value);
  };

  // 소스 URL blur 핸들러 (onBlur) - YouTube일 때만 메타데이터 호출
  const handleSourceUrlBlur = async (index: number, url: string) => {
    const row = rows[index];
    
    // YouTube일 때만 메타데이터 호출
    if (row.sourceType === "youtube") {
      if (!url.trim()) {
        setRowError(index, undefined); // URL이 비어있으면 에러 제거
        return;
      }
      
      if (!validateYouTubeUrl(url.trim())) {
        setRowError(index, "올바른 YouTube URL 또는 ID를 입력해주세요.");
        return;
      }
      
      // 유효한 YouTube URL이면 에러 제거하고 메타데이터 가져오기
      setRowError(index, undefined);
      await fetchRowYouTubeMetadata(index, url);
    }
    // Facebook일 때는 절대 메타데이터 호출하지 않음, 에러도 없음
    else if (row.sourceType === "facebook") {
      setRowError(index, undefined); // Facebook은 URL 검증 없음
    }
  };

  // 썸네일 파일 업로드 핸들러
  const handleThumbnailFileChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    // 파일 선택 시 즉시 미리보기 표시 (FileReader 사용)
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        // 미리보기를 위해 임시로 thumbnailUrl에 data URL 설정
        updateRow(index, "thumbnailUrl", result);
      }
    };
    reader.readAsDataURL(file);

    try {
      // 해당 행의 업로드 상태 설정
      updateRow(index, "uploadingThumbnail", true);
      setError(null);

      // role에 따라 썸네일 업로드 엔드포인트 선택
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      }
      const userRole = user.role as "admin" | "creator";
      
      console.log(`[대량 등록/편집] 행 ${index + 1} 썸네일 업로드 시작:`, {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userRole,
      });
      
      const result = await uploadThumbnail(file, userRole);
      
      if (result && result.url) {
        // 업로드 성공 시 즉시 실제 URL로 업데이트 (data URL 대체)
        // 함수형 업데이트를 사용하여 최신 상태 보장
        setRows((prevRows) => {
          const newRows = [...prevRows];
          if (newRows[index]) {
            newRows[index] = {
              ...newRows[index],
              thumbnailUrl: result.url, // 업로드된 실제 URL로 업데이트
              uploadingThumbnail: false,
            };
            
            console.log(`[대량 등록/편집] 행 ${index + 1} 썸네일 업로드 완료 및 상태 업데이트:`, {
              sourceType: newRows[index].sourceType,
              uploadedUrl: result.url,
              rowIndex: index,
              updatedThumbnailUrl: newRows[index].thumbnailUrl,
            });
          }
          return newRows;
        });
      } else {
        // 업로드 실패 시 안내 메시지 표시
        console.warn(`[대량 등록/편집] 행 ${index + 1} 썸네일 업로드 실패: 서버에 업로드 엔드포인트가 없습니다.`);
        setError("썸네일 업로드에 실패했습니다. 썸네일 URL을 직접 입력해주세요.");
        // 업로드 실패 시 data URL 제거 (사용자가 수동으로 URL 입력해야 함)
        updateRow(index, "thumbnailUrl", "");
        updateRow(index, "uploadingThumbnail", false);
      }
    } catch (err) {
      console.error(`[대량 등록/편집] 행 ${index + 1} 썸네일 업로드 예외 발생:`, err);
      setError("썸네일 업로드에 실패했습니다. 썸네일 URL을 직접 입력해주세요.");
      updateRow(index, "uploadingThumbnail", false);
      // 미리보기는 유지 (data URL 그대로 사용)
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // 최신 rows 상태를 가져오기 위해 ref 사용 (상태 업데이트 직후에도 최신 값 보장)
      const currentRows = rowsRef.current;
      
      // YouTube URL 검증 함수
      const validateYouTubeUrl = (url: string): boolean => {
        if (!url || !url.trim()) return false;
        
        // YouTube URL 패턴들
        const patterns = [
          /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/,
          /^[a-zA-Z0-9_-]{11}$/, // YouTube ID만 입력한 경우
        ];
        
        return patterns.some(pattern => pattern.test(url.trim()));
      };

      // 업데이트/생성할 항목들 (가장 먼저 선언 - TDZ 방지)
      // - sourceUrl이 비어있는 행은 제외
      // - 삭제 체크박스가 true인 행은 제외
      const validRows = currentRows.filter(
        (row) => !row.delete && row.sourceUrl.trim()
      );
      
      // 삭제할 항목들
      const deleteIds = currentRows.filter((row) => row.delete && row.id).map((row) => row.id!);
      
      // validRows 선언 후 로그 출력 (TDZ 방지)
      console.log(`[대량 등록/편집] 저장 시작 - 최신 rows 상태 확인:`, {
        totalRows: currentRows.length,
        validRowsCount: validRows.length,
        rowsWithThumbnail: currentRows.filter(r => r.thumbnailUrl && !r.thumbnailUrl.startsWith("data:")).length,
        facebookRowsWithThumbnail: currentRows.filter(r => r.sourceType === "facebook" && r.thumbnailUrl && !r.thumbnailUrl.startsWith("data:")).length,
        facebookRows: currentRows.filter(r => r.sourceType === "facebook").map(r => ({
          index: currentRows.indexOf(r),
          title: r.title,
          thumbnailUrl: r.thumbnailUrl ? r.thumbnailUrl.substring(0, 50) : "(없음)",
        })),
        validRowsOrder: validRows.map((r, idx) => ({
          batchOrder: idx + 1,
          title: r.title || "(제목 없음)",
          sourceType: r.sourceType,
        })),
      });

      // #region agent log - validation 확인
      console.log(`[대량 등록/편집] Validation: 전체 행 ${currentRows.length}개 | 유효 행 ${validRows.length}개 | 삭제 예정 ${deleteIds.length}개`);
      // #endregion

      if (validRows.length === 0) {
        console.error(`[대량 등록/편집] 조기 return: 저장할 항목이 없음`);
        throw new Error("저장할 항목이 없습니다. 소스 URL을 입력해주세요.");
      }

      // YouTube 행의 title/thumbnailUrl이 비어있으면 저장 전에 메타데이터 가져오기
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        // 원본 currentRows 배열에서 해당 행의 인덱스 찾기
        let rowIndex = -1;
        let foundCount = 0;
        for (let j = 0; j < currentRows.length; j++) {
          if (!currentRows[j].delete && currentRows[j].sourceUrl.trim()) {
            if (foundCount === i) {
              rowIndex = j;
              break;
            }
            foundCount++;
          }
        }
        
        if (row.sourceType === "youtube") {
          // YouTube URL 검증
          const isValidUrl = validateYouTubeUrl(row.sourceUrl.trim());
          // #region agent log - YouTube URL 검증
          console.log(`[대량 등록/편집] 행 ${rowIndex + 1} YouTube URL 검증: ${row.sourceUrl.trim()} -> ${isValidUrl ? '유효' : '무효'}`);
          // #endregion
          if (!isValidUrl) {
            if (rowIndex >= 0) {
              setRowError(rowIndex, "올바른 YouTube URL 또는 ID를 입력해주세요.");
            }
            console.error(`[대량 등록/편집] 조기 return: 행 ${rowIndex + 1} YouTube URL 검증 실패`);
            throw new Error(`행 ${rowIndex + 1}: YouTube URL이 올바르지 않습니다.`);
          }
          
          // title 또는 thumbnailUrl이 비어있으면 메타데이터 가져오기
          if ((!row.title.trim() || !row.thumbnailUrl.trim()) && row.sourceUrl.trim()) {
            try {
              // fetchYouTubeMetadata는 실패해도 에러를 throw하지 않으므로 try-catch는 안전을 위해 유지
              const metadata = await fetchYouTubeMetadata(row.sourceUrl.trim(), token || "");
              
              // title이 비어있으면 채우기
              if (!row.title.trim() && metadata.title) {
                if (rowIndex >= 0) {
                  updateRow(rowIndex, "title", metadata.title);
                }
                row.title = metadata.title;
              }
              
              // thumbnailUrl이 비어있으면 채우기
              if (!row.thumbnailUrl.trim() && metadata.thumbnail_url) {
                if (rowIndex >= 0) {
                  updateRow(rowIndex, "thumbnailUrl", metadata.thumbnail_url);
                }
                row.thumbnailUrl = metadata.thumbnail_url;
              }
            } catch (err) {
              // fetchYouTubeMetadata는 이제 에러를 throw하지 않으므로 이 블록은 실행되지 않지만, 안전을 위해 유지
              console.warn(`행 ${rowIndex + 1} 저장 전 메타데이터 가져오기 실패 (무시됨):`, err);
              // 에러는 무시하고 계속 진행 (사용자가 수동 입력 가능)
            }
          }
        }
      }

      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      }
      
      const userRole = user.role as "admin" | "creator";
      
      // site_id 가져오기 (단일 사이트 CMS이므로 항상 "gods"로 고정)
      // localStorage나 user.site_id 무시하고 항상 "gods" 사용
      const siteIdValue = "gods";
      
      // role에 따라 올바른 엔드포인트 사용 (Admin: /admin/videos, Creator: /creator/videos)
      const apiPath = getVideoApiEndpoint(userRole);
      
      const successList: Array<{ rowIndex: number; title: string }> = [];
      const failureList: Array<{ rowIndex: number; title: string; error: string }> = [];
      
      console.log(`[대량 등록/편집] ${validRows.length}개 행을 순차적으로 처리 시작 (화면 순서 유지)`);
      
      // 각 row를 순차적으로 처리 (화면의 행 순서 유지)
      // validRows는 currentRows를 filter한 결과이므로 화면 순서가 유지됨
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        // 화면에서의 실제 순서 (1부터 시작)
        const batchOrder = i + 1;
        
        // 원본 currentRows 배열에서 해당 행의 인덱스 찾기 (디버깅용)
        let rowIndex = -1;
        let foundCount = 0;
        for (let j = 0; j < currentRows.length; j++) {
          if (!currentRows[j].delete && currentRows[j].sourceUrl.trim()) {
            if (foundCount === i) {
              rowIndex = j;
              break;
            }
            foundCount++;
          }
        }
        
        console.log(`[대량 등록/편집] 행 ${rowIndex + 1} 처리 시작 (batchOrder: ${batchOrder}):`, {
          batchOrder,
          displayIndex: rowIndex + 1,
          title: row.title || "(제목 없음)",
          sourceType: row.sourceType,
          sourceUrl: row.sourceUrl.substring(0, 50),
        });
        
        try {
          // 썸네일 URL 안전하게 계산 (VideoFormModal과 동일한 흐름)
          // 우선순위: 1) 업로드된 파일 URL, 2) 사용자 입력값, 3) null
          const thumbnailUrlInput = row.thumbnailUrl?.trim() || "";
          
          // 디버깅: 썸네일 URL 입력값 확인
          console.log(`[대량 등록/편집] 행 ${rowIndex + 1} 썸네일 URL 입력값 확인:`, {
            sourceType: row.sourceType,
            thumbnailUrlInput: thumbnailUrlInput ? thumbnailUrlInput.substring(0, 100) : "(비어있음)",
            thumbnailUrlInputLength: thumbnailUrlInput.length,
            isDataUrl: thumbnailUrlInput.startsWith("data:image/"),
            isHttpUrl: thumbnailUrlInput.startsWith("http://") || thumbnailUrlInput.startsWith("https://"),
            isRelativePath: thumbnailUrlInput.startsWith("/"),
            rowObject: {
              id: row.id,
              title: row.title,
              sourceUrl: row.sourceUrl,
              thumbnailUrl: row.thumbnailUrl,
            },
          });
          
          // data URL (data:image/...)은 저장하지 않음 (서버 업로드된 실제 URL만 사용)
          let finalThumbnailUrl: string | null = null;
          if (thumbnailUrlInput && thumbnailUrlInput.trim() !== "") {
            if (thumbnailUrlInput.startsWith("data:image/")) {
              console.warn(`[대량 등록/편집] 행 ${rowIndex + 1} data URL 감지, 썸네일 URL 제거:`, thumbnailUrlInput.substring(0, 50) + "...");
              finalThumbnailUrl = null;
            } else {
              // 실제 URL인 경우 그대로 사용 (Facebook 업로드된 URL 포함)
              finalThumbnailUrl = thumbnailUrlInput;
              console.log(`[대량 등록/편집] 행 ${rowIndex + 1} 썸네일 URL 사용:`, finalThumbnailUrl);
            }
          }
          
          // YouTube일 때 썸네일이 없으면 youtubeId 기반으로 자동 생성
          if (row.sourceType === "youtube" && !finalThumbnailUrl && row.sourceUrl.trim()) {
            const youtubeId = extractYoutubeId(row.sourceUrl.trim());
            if (youtubeId) {
              finalThumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
              console.log(`[대량 등록/편집] 행 ${rowIndex + 1} YouTube 썸네일 자동 생성:`, finalThumbnailUrl);
            }
          }
          
          // Facebook일 때는 썸네일이 없어도 null로 처리 (optional)
          // 하지만 업로드된 썸네일이 있으면 반드시 사용
          if (row.sourceType === "facebook") {
            if (finalThumbnailUrl) {
              console.log(`[대량 등록/편집] 행 ${rowIndex + 1} Facebook 썸네일 URL 사용:`, finalThumbnailUrl);
            } else {
              console.log(`[대량 등록/편집] 행 ${rowIndex + 1} Facebook 썸네일 없음 (optional)`);
            }
          }
          
          // language 값 결정
          const languageValue = row.language && row.language.trim() !== "" 
            ? row.language.trim() 
            : DEFAULT_LANGUAGE;
          
          // payload 생성 - 공통 헬퍼 함수 사용 (VideoFormModal과 동일)
          // thumbnailUrl은 null이어도 명시적으로 전달 (Facebook 썸네일이 있을 수 있음)
          const basePayload = buildVideoPayload({
            sourceUrl: row.sourceUrl.trim(),
            sourceType: row.sourceType,
            title: row.title.trim(),
            thumbnailUrl: finalThumbnailUrl || undefined, // null이면 undefined로 전달 (buildVideoPayload에서 필드 제외)
            language: languageValue,
          });
          
          // 썸네일 URL을 payload에 안전하게 추가 (VideoFormModal과 동일한 방식)
          // 백엔드가 기대하는 키: thumbnailUrl 또는 thumbnail_url
          // Facebook/YouTube 구분 없이 동일하게 처리
          // buildVideoPayload에서 thumbnailUrl이 undefined면 필드를 포함하지 않으므로, 여기서 명시적으로 설정
          if (finalThumbnailUrl) {
            basePayload.thumbnailUrl = finalThumbnailUrl;
            basePayload.thumbnail_url = finalThumbnailUrl; // 백엔드가 기대하는 키 (snake_case)
          } else {
            // null인 경우에도 명시적으로 설정 (Facebook은 optional이지만, 빈 값은 null로)
            basePayload.thumbnailUrl = null;
            basePayload.thumbnail_url = null;
          }
          
          // 백엔드 필수 필드: site_id 추가
          // batchOrder 추가: 화면의 행 순서 (1부터 시작)
          const payload: any = {
            ...basePayload,
            site_id: siteIdValue,
            batchOrder: batchOrder, // 화면 순서 (1, 2, 3, ...)
            batch_order: batchOrder, // snake_case 버전 (백엔드 호환성)
            order: batchOrder, // 간단한 필드명 (백엔드 호환성)
          };
          
          // 디버깅: 저장 직전 payload 확인 (Facebook row의 thumbnailUrl 포함 여부 확인)
          console.log(`[대량 등록/편집] 행 ${rowIndex + 1} 저장 직전 payload (상세):`, {
            batchOrder: payload.batchOrder,
            sourceType: row.sourceType,
            제목: payload.title,
            플랫폼: payload.platform,
            소스URL: payload.source_url,
            thumbnailUrl: payload.thumbnailUrl,
            thumbnail_url: payload.thumbnail_url,
            finalThumbnailUrl: finalThumbnailUrl,
            thumbnailUrlInput: thumbnailUrlInput,
            site_id: payload.site_id,
            payloadKeys: Object.keys(payload),
            payloadString: JSON.stringify(payload, null, 2),
          });
          
          // POST {apiPath} 호출 (Admin: /admin/videos, Creator: /creator/videos)
          // apiClient 사용하여 일관된 에러 핸들링 및 Authorization 헤더 자동 포함
          try {
            await apiPost(apiPath, payload);
            // 성공 목록에 추가
            successList.push({
              rowIndex: rowIndex + 1,
              title: row.title.trim() || "(제목 없음)",
            });
            console.log(`[대량 등록/편집] 행 ${rowIndex + 1} 성공`);
          } catch (error: any) {
            // apiClient가 이미 에러 메시지를 개선하여 던짐
            const errorMessage = error?.message || `저장 실패`;
            
            // 401/403 응답 시 자동 로그아웃 처리
            if (error?.status === 401 || error?.status === 403) {
              console.error(`[대량 등록/편집] 인증 오류 (${error.status}): 자동 로그아웃 실행`);
              logout();
              throw new Error(`인증 오류가 발생했습니다. 다시 로그인해주세요. (${error.status})`);
            }
            
            // 실패 목록에 추가
            failureList.push({
              rowIndex: rowIndex + 1,
              title: row.title.trim() || "(제목 없음)",
              error: errorMessage,
            });
            console.error(`[대량 등록/편집] 행 ${rowIndex + 1} 실패:`, errorMessage);
          }
        } catch (err) {
          // 예외 발생 시 실패 목록에 추가
          const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
          failureList.push({
            rowIndex: rowIndex + 1,
            title: row.title.trim() || "(제목 없음)",
            error: errorMessage,
          });
          console.error(`[대량 등록/편집] 행 ${rowIndex + 1} 예외 발생:`, err);
          
          // 401/403이면 전체 중단
          if (err instanceof Error && (err.message.includes("401") || err.message.includes("403"))) {
            throw err;
          }
        }
      }
      
      // 결과 요약 표시
      const totalCount = validRows.length;
      const successCount = successList.length;
      const failureCount = failureList.length;
      
      console.log(`[대량 등록/편집] 처리 완료: 전체 ${totalCount}개, 성공 ${successCount}개, 실패 ${failureCount}개`);
      
      if (failureCount > 0) {
        // 일부 실패한 경우
        const failureMessages = failureList.map(f => `행 ${f.rowIndex} (${f.title}): ${f.error}`).join('\n');
        const summaryMessage = `대량 등록 완료:\n\n성공: ${successCount}개\n실패: ${failureCount}개\n\n실패 상세:\n${failureMessages}`;
        
        alert(summaryMessage);
        setError(`성공: ${successCount}개, 실패: ${failureCount}개 (자세한 내용은 알림을 확인하세요)`);
        
        // 성공한 항목이 있으면 목록 새로고침
        if (successCount > 0) {
          await onSuccess();
        }
      } else {
        // 모두 성공한 경우
        alert(`대량 등록 완료:\n\n성공: ${successCount}개`);

      // 목록 새로고침
      await onSuccess();
      
      // 모달 닫기
      onClose();
      }
    } catch (err) {
      console.error("Failed to save bulk videos:", err);
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-videos-modal-overlay" onClick={onClose}>
      <div className="bulk-videos-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="bulk-videos-modal-close" onClick={onClose}>
          ×
        </button>
        <h2 className="bulk-videos-modal-title">대량 등록/편집</h2>

        {error && (
          <div className="bulk-videos-modal-error">
            <p>{error}</p>
          </div>
        )}

        <div className="bulk-videos-header">
          <p className="bulk-videos-info">최대 {MAX_ROWS}개까지 한 번에 관리할 수 있습니다. (현재 {rows.length}개)</p>
          <button
            type="button"
            onClick={addRows}
            disabled={rows.length >= MAX_ROWS}
            className="bulk-videos-add-row-button"
          >
            행 추가({ROWS_TO_ADD}개)
          </button>
        </div>

        <div className="bulk-videos-table-wrapper">
          <table className="bulk-videos-table">
            <thead>
              <tr>
                <th>
                  소스 타입
                  <div style={{ marginTop: "8px", display: "flex", gap: "4px", alignItems: "center" }}>
                    <select
                      value={bulkSourceType}
                      onChange={(e) => setBulkSourceType(e.target.value as "youtube" | "facebook")}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: "white",
                      }}
                    >
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                    </select>
                    <button
                      type="button"
                      onClick={applyBulkSourceType}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "#0052cc",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      일괄 적용
                    </button>
                  </div>
                </th>
                <th>소스 URL</th>
                <th>제목</th>
                <th>
                  언어
                  <div style={{ marginTop: "8px", display: "flex", gap: "4px", alignItems: "center" }}>
                    <select
                      value={bulkLanguage}
                      onChange={(e) => setBulkLanguage(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        backgroundColor: "white",
                      }}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={applyBulkLanguage}
                      style={{
                        padding: "4px 8px",
                        fontSize: "12px",
                        backgroundColor: "#0052cc",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      일괄 적용
                    </button>
                  </div>
                </th>
                <th>썸네일 URL</th>
                <th>썸네일 파일 업로드</th>
                <th style={{ width: "60px" }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td>
                    <select
                      value={row.sourceType}
                      onChange={(e) =>
                        updateRow(index, "sourceType", e.target.value as "youtube" | "facebook")
                      }
                      className="bulk-videos-select"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.sourceUrl}
                      onChange={(e) => handleSourceUrlChange(index, e.target.value)}
                      onBlur={(e) => handleSourceUrlBlur(index, e.target.value)}
                      className="bulk-videos-input"
                      placeholder={
                        row.sourceType === "youtube" 
                          ? "YouTube URL 또는 ID" 
                          : "Facebook URL"
                      }
                      style={{
                        borderColor: row.error ? "#ef4444" : undefined,
                      }}
                    />
                    {row.fetchingMetadata && (
                      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", marginBottom: 0 }}>
                        메타데이터 가져오는 중...
                      </p>
                    )}
                    {row.error && (
                      <p style={{ fontSize: "11px", color: "#ef4444", marginTop: "2px", marginBottom: 0 }}>
                        {row.error}
                      </p>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.title}
                      onChange={(e) => updateRow(index, "title", e.target.value)}
                      className="bulk-videos-input"
                      placeholder="제목"
                    />
                  </td>
                  <td>
                    <select
                      value={row.language || DEFAULT_LANGUAGE}
                      onChange={(e) => updateRow(index, "language", e.target.value)}
                      className="bulk-videos-select"
                      style={{ width: "100%" }}
                    >
                      {LANGUAGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.thumbnailUrl}
                      onChange={(e) => updateRow(index, "thumbnailUrl", e.target.value)}
                      className="bulk-videos-input"
                      placeholder={
                        row.sourceType === "youtube"
                          ? "YouTube URL 입력 시 자동으로 채워집니다"
                          : "선택 사항: 썸네일 URL을 입력하세요 (비워도 저장 가능)"
                      }
                    />
                    {row.thumbnailUrl && (
                      <div style={{ marginTop: "4px" }}>
                        <img
                          src={row.thumbnailUrl}
                          alt="thumbnail preview"
                          onError={(e) => {
                            console.error(`행 ${index + 1} 썸네일 이미지 로드 실패:`, row.thumbnailUrl);
                          }}
                          style={{
                            maxWidth: "80px",
                            maxHeight: "45px",
                            borderRadius: "4px",
                            border: "1px solid #e5e7eb",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    )}
                  </td>
                  <td>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleThumbnailFileChange(index, e)}
                      disabled={row.uploadingThumbnail}
                      style={{
                        padding: "4px",
                        fontSize: "12px",
                        border: "1px solid #d1d5db",
                        borderRadius: "4px",
                        width: "100%",
                      }}
                    />
                    {row.uploadingThumbnail && (
                      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", marginBottom: 0 }}>
                        업로드 중...
                      </p>
                    )}
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.delete}
                      onChange={(e) => updateRow(index, "delete", e.target.checked)}
                      className="bulk-videos-checkbox"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bulk-videos-modal-actions">
          <button type="button" onClick={onClose} className="bulk-videos-button-cancel">
            닫기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bulk-videos-button-submit"
          >
            {loading ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}


