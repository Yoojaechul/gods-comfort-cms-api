import { useState, useEffect } from "react";
import type { Video, VideoPayload } from "../../types/video";
import { CMS_API_BASE } from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { uploadThumbnail } from "../../lib/cmsClient";
import "./VideoFormModal.css";

// 언어 옵션 정의
const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'ENGLISH' },
  { value: 'ko', label: 'KOREAN' },
  { value: 'pt', label: 'PORTUGUESE' },
  { value: 'es', label: 'SPANISH' },
  { value: 'ar', label: 'ARABIC' },
  { value: 'cs', label: 'CZECH' },
];

interface VideoFormModalProps {
  mode: "create" | "edit";
  initialVideo: Video | null;
  onSubmit: (updatedVideo?: Video) => Promise<void>;
  onClose: () => void;
  onSaved?: (video: Video) => void; // 저장 성공 시 상위에 알려주는 콜백
}

export default function VideoFormModal({
  mode,
  initialVideo,
  onSubmit,
  onClose,
  onSaved,
}: VideoFormModalProps) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [formData, setFormData] = useState<VideoPayload>({
    title: "",
    description: "",
    creatorName: "",
    sourceType: "youtube",
    sourceUrl: "",
    thumbnailUrl: "",
    language: "ko", // 기본값은 한국어
    views_actual: 0,
    views_display: 0,
    likes_actual: 0,
    likes_display: 0,
    shares_actual: 0,
    shares_display: 0,
  });

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

  // 초기 데이터 로드 및 Creator name 자동 채우기
  useEffect(() => {
    if (initialVideo && mode === "edit") {
      // 초기값을 API에서 받은 값으로 세팅 (Number()로 명시적 변환)
      setFormData({
        title: initialVideo.title || "",
        description: initialVideo.description || "", // optional 필드 안전 처리
        creatorName: initialVideo.creatorName || "",
        sourceType: (initialVideo as any).sourceType || 
          ((initialVideo as any).video_type === "facebook" ? "facebook" : 
           (initialVideo as any).video_type === "file" ? "file" : "youtube"),
        sourceUrl: (initialVideo as any).sourceUrl || (initialVideo as any).source_url || (initialVideo as any).youtube_id || "",
        thumbnailUrl: initialVideo.thumbnailUrl || (initialVideo as any).thumbnail_url || "",
        language: initialVideo.language || (initialVideo as any).lang || "ko", // 언어 코드
        views_actual: Number(initialVideo.viewCountReal) || 0,
        views_display: Number(initialVideo.viewDisplay) || 0,
        likes_actual: Number(initialVideo.likeCountReal) || 0,
        likes_display: Number(initialVideo.likeDisplay) || 0,
        shares_actual: Number(initialVideo.shareCountReal) || 0,
        shares_display: Number(initialVideo.shareDisplay) || 0,
      });
    } else {
      // Create mode: reset form and auto-fill creator name
      setFormData({
        title: "",
        description: "", // 빈 문자열로 초기화 (optional 필드)
        creatorName: user?.name || "",
        sourceType: "youtube",
        sourceUrl: "",
        thumbnailUrl: "",
        language: "ko", // 기본값은 한국어
        views_actual: 0,
        views_display: 0,
        likes_actual: 0,
        likes_display: 0,
        shares_actual: 0,
        shares_display: 0,
      });
    }
  }, [initialVideo, mode, user]);

  // Source URL 메타데이터 가져오기 (YouTube와 Facebook만 지원)
  const fetchMetadata = async () => {
    if (!formData.sourceUrl || !formData.sourceType) {
      return;
    }

    // 파일 업로드 타입은 메타데이터 가져오기 안 함
    if (formData.sourceType === "file") {
      return;
    }

    setMetadataLoading(true);
    setMetadataError(null);

    try {
      const response = await fetch(`${CMS_API_BASE}/videos/metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_type: formData.sourceType,
          source_url: formData.sourceUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "메타데이터를 가져오는데 실패했습니다.");
      }

      const data = await response.json();
      
      // 메타데이터로 자동 채우기
      if (data.title) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      if (data.description) {
        setFormData((prev) => ({ ...prev, description: data.description }));
      }
      if (data.thumbnail_url) {
        setFormData((prev) => ({ ...prev, thumbnailUrl: data.thumbnail_url }));
      }
    } catch (err) {
      console.error("Failed to fetch metadata:", err);
      setMetadataError(err instanceof Error ? err.message : "메타데이터를 가져오는데 실패했습니다.");
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // YouTube일 때만 URL 검증
      if (formData.sourceType === "youtube" && formData.sourceUrl) {
        if (!validateYouTubeUrl(formData.sourceUrl)) {
          setError("올바른 YouTube URL 또는 ID를 입력해주세요.");
          setLoading(false);
          return;
        }
      }

      const url =
        mode === "create"
          ? `${CMS_API_BASE}/admin/videos`
          : `${CMS_API_BASE}/admin/videos/${initialVideo?.id}`;

      const method = mode === "create" ? "POST" : "PUT";

      // description과 creatorName은 UI에서 제거되었지만, 폼 상태에는 있으므로 기본값 처리
      // description이 빈 문자열이어도 그대로 전송 (optional 필드)
      // creatorName은 현재 로그인 사용자 정보에서 가져오거나 빈 문자열로 처리
      const payload: any = {
        ...formData,
        description: formData.description || undefined, // 빈 문자열이면 undefined로 변환 (선택사항)
        creatorName: formData.creatorName || user?.name || user?.username || undefined, // 현재 로그인 사용자 정보 사용
        language: formData.language || "ko", // 언어 코드 포함
        thumbnailUrl: formData.thumbnailUrl || undefined, // 썸네일 URL 포함 (빈 문자열이면 undefined)
      };

      // 디버깅을 위해 콘솔에 로그 출력 (create/edit 모두)
      console.log(`${mode === "create" ? "생성" : "편집"} payload:`, {
        title: payload.title,
        language: payload.language,
        thumbnailUrl: payload.thumbnailUrl,
        sourceType: payload.sourceType,
        sourceUrl: payload.sourceUrl,
      });

      // 편집 모드일 때만 실제 값과 노출 값 포함 (Number()로 명시적 변환)
      if (mode === "edit") {
        // 실제 값 (왼쪽 입력)
        payload.viewCount = Number(formData.views_actual) || 0;
        payload.likeCount = Number(formData.likes_actual) || 0;
        payload.shareCount = Number(formData.shares_actual) || 0;
        
        // 노출 값 (오른쪽 입력) → 반드시 이 이름으로 보내야 함
        payload.viewDisplay = Number(formData.views_display) || 0;
        payload.likeDisplay = Number(formData.likes_display) || 0;
        payload.shareDisplay = Number(formData.shares_display) || 0;
        
        // 편집 모드 추가 디버깅 로그
        console.log("편집 payload (메트릭스 포함):", {
          viewCount: payload.viewCount,
          likeCount: payload.likeCount,
          shareCount: payload.shareCount,
          viewDisplay: payload.viewDisplay,
          likeDisplay: payload.likeDisplay,
          shareDisplay: payload.shareDisplay,
        });
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "저장에 실패했습니다.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        throw new Error(errorMessage);
      }

      // 성공 시 백엔드 응답에서 업데이트된 video 객체 가져오기
      const responseData = await response.json();
      const rawVideo = responseData.video || responseData.data || responseData;
      
      // 백엔드 응답 필드명을 프론트엔드 필드명으로 매핑
      // 백엔드에서 보낼 수 있는 다양한 필드명을 처리
      const updatedVideo: Video = {
        ...rawVideo,
        // 관리번호 및 언어 매핑
        managementId: rawVideo.managementId ?? rawVideo.management_id ?? rawVideo.video_code ?? null,
        language: rawVideo.language ?? rawVideo.lang ?? "ko",
        // metrics 필드 매핑 (다양한 백엔드 필드명 지원)
        viewCountReal: rawVideo.viewCountReal ?? rawVideo.view_count_real ?? rawVideo.viewReal ?? rawVideo.views_actual ?? 0,
        viewDisplay: rawVideo.viewDisplay ?? rawVideo.view_display ?? rawVideo.views_display ?? 0,
        likeCountReal: rawVideo.likeCountReal ?? rawVideo.like_count_real ?? rawVideo.likeReal ?? rawVideo.likes_actual ?? 0,
        likeDisplay: rawVideo.likeDisplay ?? rawVideo.like_display ?? rawVideo.likes_display ?? 0,
        shareCountReal: rawVideo.shareCountReal ?? rawVideo.share_count_real ?? rawVideo.shareReal ?? rawVideo.shares_actual ?? 0,
        shareDisplay: rawVideo.shareDisplay ?? rawVideo.share_display ?? rawVideo.shares_display ?? 0,
      };
      
      // 디버깅을 위해 콘솔에 응답 로그 출력
      console.log("저장 response:", {
        id: updatedVideo.id,
        title: updatedVideo.title,
        language: updatedVideo.language,
        managementId: updatedVideo.managementId || (updatedVideo as any).video_code,
        viewCountReal: updatedVideo.viewCountReal,
        viewDisplay: updatedVideo.viewDisplay,
        likeCountReal: updatedVideo.likeCountReal,
        likeDisplay: updatedVideo.likeDisplay,
        shareCountReal: updatedVideo.shareCountReal,
        shareDisplay: updatedVideo.shareDisplay,
      });

      // 성공 시 토스트 메시지 표시
      setSuccessMessage("저장되었습니다.");
      setError(null); // 에러 메시지 초기화
      
      // onSaved 콜백 호출 (즉시 리스트 업데이트를 위해)
      if (onSaved && updatedVideo) {
        onSaved(updatedVideo);
      }
      
      // 목록 새로고침 (업데이트된 video 객체 전달)
      await onSubmit(updatedVideo);
      
      // 약간의 지연 후 모달 닫기 (토스트 메시지를 볼 수 있도록)
      setTimeout(() => {
        setSuccessMessage(null); // 성공 메시지 초기화
        onClose();
      }, 500);
    } catch (err) {
      console.error("Failed to save video:", err);
      const errorMessage = err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
      setError(errorMessage);
      // 에러 발생 시에도 모달은 유지 (사용자가 수정 가능)
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    // 입력값이 문자열로 들어온다면 Number()로 숫자로 변환
    const updatedFormData: any = {
      ...formData,
      [name]: name.includes("_actual") || name.includes("_display") 
        ? Number(value) || 0  // 숫자 필드는 Number()로 명시적 변환
        : value,
    };

    setFormData(updatedFormData);
  };

  const handleSourceUrlBlur = () => {
    // Source URL이 입력되고 sourceType이 설정되어 있으면 메타데이터 가져오기
    // 파일 업로드 타입은 메타데이터 가져오기 안 함
    if (formData.sourceUrl && formData.sourceType && formData.sourceType !== "file") {
      fetchMetadata();
    }
  };

  // 썸네일 파일 업로드 핸들러
  const handleThumbnailFileChange = async (
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
      setUploadingThumbnail(true);
      setError(null);
      
      console.log("썸네일 파일 업로드 시작:", { fileName: file.name, fileType: file.type, fileSize: file.size });
      
      const { url } = await uploadThumbnail(file);
      
      console.log("uploaded thumbnail url:", url);
      
      // formData 상태 업데이트
      setFormData((prev) => {
        const updated = { ...prev, thumbnailUrl: url };
        console.log("formData.thumbnailUrl 업데이트:", updated.thumbnailUrl);
        return updated;
      });
      
      console.log("썸네일 업로드 완료:", url);
    } catch (err) {
      console.error("thumbnail upload error", err);
      setError(err instanceof Error ? err.message : "썸네일 업로드에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const showMetrics = mode === "edit" && isAdmin;

  return (
    <div className="video-form-modal-overlay" onClick={onClose}>
      <div className="video-form-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-form-modal-close" onClick={onClose}>
          ×
        </button>
        <h2 className="video-form-modal-title">
          {mode === "create" ? "영상 추가" : "영상 편집"}
        </h2>

        {successMessage && (
          <div className="video-form-modal-error" style={{ backgroundColor: "#d4edda", color: "#155724", border: "1px solid #c3e6cb" }}>
            <p>{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="video-form-modal-error">
            <p>{error}</p>
          </div>
        )}

        {metadataError && (
          <div className="video-form-modal-error" style={{ backgroundColor: "#fff3cd", color: "#856404" }}>
            <p>메타데이터: {metadataError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="video-form-modal-form">
          {/* 1. Source URL */}
          <div className="video-form-field">
            <label className="video-form-label">
              소스 URL <span className="required">*</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                name="sourceUrl"
                value={formData.sourceUrl}
                onChange={handleChange}
                onBlur={handleSourceUrlBlur}
                className="video-form-input"
                placeholder={
                  formData.sourceType === "youtube" 
                    ? "YouTube URL 또는 ID" 
                    : formData.sourceType === "facebook"
                    ? "Facebook URL"
                    : "파일 URL 또는 경로"
                }
                required
                style={{ flex: 1 }}
              />
              {metadataLoading && (
                <button type="button" disabled style={{ padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "4px", cursor: "not-allowed" }}>
                  로딩...
                </button>
              )}
            </div>
          </div>

          {/* 2. Source Type */}
          <div className="video-form-field">
            <label className="video-form-label">
              소스 타입 <span className="required">*</span>
            </label>
            <select
              name="sourceType"
              value={formData.sourceType}
              onChange={handleChange}
              className="video-form-select"
              required
            >
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
              <option value="file">파일 업로드</option>
            </select>
          </div>

          {/* 3. Title */}
          <div className="video-form-field">
            <label className="video-form-label">
              제목 <span className="required">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="video-form-input"
              required
            />
          </div>

          {/* 4. Thumbnail URL */}
          <div className="video-form-field">
            <label className="video-form-label">썸네일 URL</label>
            <input
              type="text"
              name="thumbnailUrl"
              value={formData.thumbnailUrl}
              onChange={handleChange}
              className="video-form-input"
              placeholder="직접 URL을 입력하거나 아래에서 파일을 업로드하세요."
            />
            <div style={{ marginTop: "8px" }}>
              <label className="video-form-label" style={{ fontSize: "14px", marginBottom: "4px", display: "block" }}>
                썸네일 파일 업로드
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleThumbnailFileChange}
                disabled={uploadingThumbnail}
                style={{
                  padding: "4px",
                  fontSize: "14px",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  width: "100%",
                }}
              />
              {uploadingThumbnail && (
                <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  썸네일 업로드 중...
                </p>
              )}
              {formData.thumbnailUrl && (
                <div style={{ marginTop: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                    미리보기:
                  </span>
                  <img
                    src={formData.thumbnailUrl}
                    alt="thumbnail preview"
                    onLoad={() => {
                      console.log("썸네일 미리보기 이미지 로드 성공:", formData.thumbnailUrl);
                    }}
                    onError={(e) => {
                      console.error("썸네일 미리보기 이미지 로드 실패:", formData.thumbnailUrl, e);
                      setError("썸네일 이미지를 불러올 수 없습니다. URL을 확인해주세요.");
                    }}
                    style={{
                      maxWidth: "160px",
                      maxHeight: "90px",
                      borderRadius: "4px",
                      border: "1px solid #e5e7eb",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 상세 정보 섹션 - 편집 모드에서만 표시 */}
          {mode === "edit" && initialVideo && (
            <div className="video-form-metrics-section" style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
              <h3 className="video-form-metrics-title">상세 정보</h3>

              <div className="video-form-metrics-grid">
                {/* 영상 관리번호 */}
                <div className="video-form-field">
                  <label className="video-form-label">영상 관리번호</label>
                  <input
                    type="text"
                    value={initialVideo.managementId || (initialVideo as any).video_code || ""}
                    placeholder="저장 시 자동 생성 (YYMMDD-XXX)"
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>

                {/* 언어 - 드롭다운으로 변경 */}
                <div className="video-form-field">
                  <label className="video-form-label">언어</label>
                  <select
                    name="language"
                    value={formData.language || initialVideo.language || (initialVideo as any).lang || "ko"}
                    onChange={handleChange}
                    className="video-form-select"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 플랫폼 */}
                <div className="video-form-field">
                  <label className="video-form-label">플랫폼</label>
                  <input
                    type="text"
                    value={formData.sourceType === "youtube" ? "YouTube" : formData.sourceType === "facebook" ? "Facebook" : "파일 업로드"}
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>

                {/* 등록일 */}
                <div className="video-form-field">
                  <label className="video-form-label">등록일</label>
                  <input
                    type="text"
                    value={initialVideo.createdAt ? new Date(initialVideo.createdAt).toLocaleString("ko-KR") : "-"}
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Metrics Section - Only for admin edit mode */}
          {showMetrics && (
            <div className="video-form-metrics-section">
              <h3 className="video-form-metrics-title">메트릭스</h3>

              <div className="video-form-metrics-grid">
                <div className="video-form-field">
                  <label className="video-form-label">조회수 (실제)</label>
                  <input
                    type="number"
                    name="views_actual"
                    value={formData.views_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">조회수 (노출)</label>
                  <input
                    type="number"
                    name="views_display"
                    value={formData.views_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">좋아요 (실제)</label>
                  <input
                    type="number"
                    name="likes_actual"
                    value={formData.likes_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">좋아요 (노출)</label>
                  <input
                    type="number"
                    name="likes_display"
                    value={formData.likes_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">공유 (실제)</label>
                  <input
                    type="number"
                    name="shares_actual"
                    value={formData.shares_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">공유 (노출)</label>
                  <input
                    type="number"
                    name="shares_display"
                    value={formData.shares_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="video-form-modal-actions">
            <button type="button" onClick={onClose} className="video-form-button-cancel">
              취소
            </button>
            <button type="submit" disabled={loading} className="video-form-button-submit">
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
