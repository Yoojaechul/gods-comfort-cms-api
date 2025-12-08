import { useState, useEffect } from "react";
import type { Video, VideoPayload } from "../../types/video";
import { CMS_API_BASE } from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { uploadThumbnail } from "../../lib/cmsClient";
import "./BulkVideosModal.css";

interface BulkVideoRow {
  id?: string;
  delete: boolean;
  title: string;
  sourceType: "youtube" | "file" | "facebook";
  sourceUrl: string;
  thumbnailUrl: string;
  uploadingThumbnail?: boolean; // 썸네일 업로드 중 상태
  fetchingMetadata?: boolean; // YouTube 메타데이터 가져오는 중 상태
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
  uploadingThumbnail: false,
  fetchingMetadata: false,
});

// YouTube URL에서 videoId 추출 함수
function extractYoutubeId(url: string): string | null {
  if (!url || !url.trim()) return null;
  
  const trimmed = url.trim();
  
  // YouTube ID만 입력한 경우 (11자리)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  
  // YouTube URL 패턴들
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// YouTube URL 검증 함수
function isYouTubeUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  const trimmed = url.trim();
  return /youtube\.com|youtu\.be/.test(trimmed) || /^[a-zA-Z0-9_-]{11}$/.test(trimmed);
}

export default function BulkVideosModal({ onClose, onSuccess }: BulkVideosModalProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 소스 타입 일괄 변경용 상태
  const [bulkSourceType, setBulkSourceType] = useState<"youtube" | "facebook">("youtube");
  
  // 초기 10개 행 생성
  const [rows, setRows] = useState<BulkVideoRow[]>(() => {
    return Array.from({ length: INITIAL_ROWS }, () => createEmptyRow());
  });

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
    newRows[index] = {
      ...newRows[index],
      [field]: value,
    };
    setRows(newRows);
  };

  // 소스 타입 일괄 적용
  const applyBulkSourceType = () => {
    setRows((prev) => prev.map((row) => ({ ...row, sourceType: bulkSourceType })));
  };

  // YouTube 메타데이터 가져오기
  const fetchYouTubeMetadata = async (index: number, url: string) => {
    // 최신 rows 상태 확인
    setRows((currentRows) => {
      const row = currentRows[index];
      
      // YouTube가 아니거나 URL이 비어있으면 스킵
      if (row.sourceType !== "youtube" || !url.trim() || !isYouTubeUrl(url.trim())) {
        return currentRows;
      }

      // 비동기 작업 시작
      (async () => {
        try {
          // fetchingMetadata 상태 설정
          setRows((prev) => {
            const newRows = [...prev];
            if (newRows[index].sourceType === "youtube") {
              newRows[index] = { ...newRows[index], fetchingMetadata: true };
            }
            return newRows;
          });
          
          const videoId = extractYoutubeId(url.trim());
          if (!videoId) {
            console.warn(`행 ${index + 1}: YouTube videoId를 추출할 수 없습니다.`);
            setRows((prev) => {
              const newRows = [...prev];
              newRows[index] = { ...newRows[index], fetchingMetadata: false };
              return newRows;
            });
            return;
          }

          const oembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url.trim())}`;
          const response = await fetch(oembedUrl);
          
          if (!response.ok) {
            throw new Error(`noembed API 호출 실패: ${response.status}`);
          }

          const data = await response.json();
          
          // 최신 rows 상태를 다시 가져와서 확인 후 업데이트
          setRows((prev) => {
            const newRows = [...prev];
            const currentRow = newRows[index];
            
            // YouTube가 아니면 스킵
            if (currentRow.sourceType !== "youtube") {
              return prev;
            }
            
            // title이 비어있으면 채우기
            if (!currentRow.title.trim() && data.title) {
              newRows[index] = { ...currentRow, title: data.title };
            }
            
            // thumbnailUrl이 비어있으면 채우기
            if (!currentRow.thumbnailUrl.trim()) {
              const thumbnailUrl = data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
              newRows[index] = { ...newRows[index], thumbnailUrl };
            }
            
            // fetchingMetadata 상태 해제
            newRows[index] = { ...newRows[index], fetchingMetadata: false };
            
            return newRows;
          });
          
          console.log(`행 ${index + 1} YouTube 메타데이터 가져오기 완료:`, { title: data.title, thumbnail: data.thumbnail_url });
        } catch (err) {
          console.warn(`행 ${index + 1} YouTube 메타데이터 가져오기 실패:`, err);
          // UI에는 에러를 표시하지 않음 (요구사항)
          // fetchingMetadata 상태 해제
          setRows((prev) => {
            const newRows = [...prev];
            newRows[index] = { ...newRows[index], fetchingMetadata: false };
            return newRows;
          });
        }
      })();

      return currentRows;
    });
  };

  // 소스 URL 변경 핸들러 (onChange)
  const handleSourceUrlChange = (index: number, value: string) => {
    updateRow(index, "sourceUrl", value);
  };

  // 소스 URL blur 핸들러 (onBlur)
  const handleSourceUrlBlur = async (index: number, url: string) => {
    const row = rows[index];
    if (row.sourceType === "youtube" && url.trim() && isYouTubeUrl(url.trim())) {
      await fetchYouTubeMetadata(index, url);
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

    try {
      // 해당 행의 업로드 상태 설정
      updateRow(index, "uploadingThumbnail", true);
      setError(null);

      const { url } = await uploadThumbnail(file);
      updateRow(index, "thumbnailUrl", url);
      updateRow(index, "uploadingThumbnail", false);
      
      console.log(`행 ${index + 1} 썸네일 업로드 완료:`, url);
    } catch (err) {
      console.error(`행 ${index + 1} 썸네일 업로드 실패:`, err);
      setError(err instanceof Error ? err.message : "썸네일 업로드에 실패했습니다.");
      updateRow(index, "uploadingThumbnail", false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      // 삭제할 항목들
      const deleteIds = rows.filter((row) => row.delete && row.id).map((row) => row.id!);

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

      // 업데이트/생성할 항목들
      // - sourceUrl이 비어있는 행은 제외
      // - 삭제 체크박스가 true인 행은 제외
      const validRows = rows.filter(
        (row) => !row.delete && row.sourceUrl.trim()
      );

      if (validRows.length === 0) {
        throw new Error("저장할 항목이 없습니다. 소스 URL을 입력해주세요.");
      }

      // YouTube일 때만 URL 검증
      for (const row of validRows) {
        if (row.sourceType === "youtube" && row.sourceUrl.trim() && !validateYouTubeUrl(row.sourceUrl.trim())) {
          throw new Error(`"${row.title || '제목 없음'}" 행의 YouTube URL이 올바르지 않습니다.`);
        }
      }

      // payload 생성
      const payload = validRows.map((row) => ({
        sourceUrl: row.sourceUrl.trim(),
        sourceType: row.sourceType === "youtube" ? "youtube" : row.sourceType === "facebook" ? "facebook" : "file",
        title: row.title.trim() || undefined,
        thumbnailUrl: row.thumbnailUrl.trim() || undefined,
      }));

      console.log("대량 등록/편집 요청 payload:", payload);

      // 대량 등록/편집 API 호출
      const response = await fetch(`${CMS_API_BASE}/videos/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `저장에 실패했습니다. (${response.status})`;
        console.error("대량 등록/편집 API 오류:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
        throw new Error(errorMessage);
      }

      // 성공 응답 처리
      const responseData = await response.json().catch(() => ({}));
      console.log("대량 등록/편집 성공 응답:", responseData);

      // 목록 새로고침
      await onSuccess();
      
      // 모달 닫기
      onClose();
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
                <th>소스 URL</th>
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
                <th>제목</th>
                <th>썸네일 URL</th>
                <th>썸네일 파일 업로드</th>
                <th style={{ width: "60px" }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
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
                          : row.sourceType === "facebook"
                          ? "Facebook URL"
                          : "파일 URL 또는 경로"
                      }
                    />
                    {row.fetchingMetadata && (
                      <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", marginBottom: 0 }}>
                        메타데이터 가져오는 중...
                      </p>
                    )}
                  </td>
                  <td>
                    <select
                      value={row.sourceType}
                      onChange={(e) =>
                        updateRow(index, "sourceType", e.target.value as "youtube" | "file" | "facebook")
                      }
                      className="bulk-videos-select"
                    >
                      <option value="youtube">YouTube</option>
                      <option value="facebook">Facebook</option>
                      <option value="file">파일 업로드</option>
                    </select>
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
                    <input
                      type="text"
                      value={row.thumbnailUrl}
                      onChange={(e) => updateRow(index, "thumbnailUrl", e.target.value)}
                      className="bulk-videos-input"
                      placeholder="직접 URL을 입력하거나 아래에서 파일을 업로드하세요."
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

