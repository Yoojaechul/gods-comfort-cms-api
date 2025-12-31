import { useEffect, useMemo, useState } from "react";
import type { Video, VideoPayload } from "../../types/video";
import { useAuth } from "../../contexts/AuthContext";
import { uploadThumbnail } from "../../lib/cmsClient";
import { getVideoApiEndpoint } from "../../lib/videoApi";
import { buildVideoPayload } from "../../utils/videoPayload";
import { apiPost, apiPut } from "../../lib/apiClient";
import {
  fetchYouTubeMetadata,
  validateYouTubeUrl,
  validateFacebookUrl,
  extractYoutubeId,
  normalizeThumbnailUrl,
  resolveMediaUrl,
} from "../../utils/videoMetadata";
import { LANGUAGE_OPTIONS } from "../../constants/languages";
import "./VideoFormModal.css";

interface VideoFormModalProps {
  mode: "create" | "edit";
  initialVideo: Video | null;
  onSubmit: (updatedVideo?: Video) => Promise<void>;
  onClose: () => void;
  onSaved?: (video: Video) => void;
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

  const [metadataLoading, setMetadataLoading] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);

  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  const [formData, setFormData] = useState<VideoPayload>({
    title: "",
    description: "",
    creatorName: "",
    sourceType: "youtube",
    sourceUrl: "",
    thumbnailUrl: "",
    language: "en",
    views_actual: 0,
    views_display: 0,
    likes_actual: 0,
    likes_display: 0,
    shares_actual: 0,
    shares_display: 0,
  });

  // edit 초기 로드
  useEffect(() => {
    if (initialVideo && mode === "edit") {
      const sourceType =
        (initialVideo as any).sourceType ||
        ((initialVideo as any).video_type === "facebook" ? "facebook" : "youtube");
      
      // 플랫폼에 따라 적절한 URL 필드에서 값 가져오기
      let sourceUrl = "";
      if (sourceType === "facebook") {
        sourceUrl =
          (initialVideo as any).facebook_url ||
          (initialVideo as any).url ||
          (initialVideo as any).sourceUrl ||
          (initialVideo as any).source_url ||
          "";
      } else {
        // YouTube
        sourceUrl =
          (initialVideo as any).youtube_url ||
          (initialVideo as any).sourceUrl ||
          (initialVideo as any).source_url ||
          (initialVideo as any).youtube_id ||
          "";
      }

      setFormData({
        title: initialVideo.title || "",
        description: initialVideo.description || "",
        creatorName: initialVideo.creatorName || "",
        sourceType,
        sourceUrl,
        thumbnailUrl:
          (initialVideo as any).thumbnailUrl ||
          (initialVideo as any).thumbnail_url ||
          "",
        language: (initialVideo as any).language || (initialVideo as any).lang || "en",
        views_actual: Number((initialVideo as any).viewCountReal) || 0,
        views_display: Number((initialVideo as any).viewDisplay) || 0,
        likes_actual: Number((initialVideo as any).likeCountReal) || 0,
        likes_display: Number((initialVideo as any).likeDisplay) || 0,
        shares_actual: Number((initialVideo as any).shareCountReal) || 0,
        shares_display: Number((initialVideo as any).shareDisplay) || 0,
      });
      setTitleTouched(true);
    } else {
      setFormData((prev) => ({
        ...prev,
        title: "",
        description: "",
        creatorName: user?.name || "",
        sourceType: "youtube",
        sourceUrl: "",
        thumbnailUrl: "",
        language: "en",
        views_actual: 0,
        views_display: 0,
        likes_actual: 0,
        likes_display: 0,
        shares_actual: 0,
        shares_display: 0,
      }));
      setTitleTouched(false);
    }
  }, [initialVideo, mode, user?.name]);

  const isYouTube = formData.sourceType === "youtube";
  const isFacebook = formData.sourceType === "facebook";

  // URL 입력 디바운스 -> 유튜브 제목/썸네일 자동
  useEffect(() => {
    if (!isYouTube) return;
    const v = (formData.sourceUrl || "").trim();
    if (!v) return;
    if (!validateYouTubeUrl(v)) return;
    if (titleTouched) return;

    const t = setTimeout(async () => {
      setMetadataLoading(true);
      try {
        const meta = await fetchYouTubeMetadata(v);

        if (meta.title && !titleTouched) {
          setFormData((p) => ({ ...p, title: meta.title || "" }));
        }

        // 썸네일이 비어있으면 자동 채움
        if (!formData.thumbnailUrl && meta.thumbnail_url) {
          setFormData((p) => ({ ...p, thumbnailUrl: meta.thumbnail_url || "" }));
        }

        // meta 썸네일도 없으면 videoId 기반 생성
        if (!formData.thumbnailUrl && !meta.thumbnail_url) {
          const id = extractYoutubeId(v);
          if (id) {
            setFormData((p) => ({
              ...p,
              thumbnailUrl: `https://img.youtube.com/vi/${id}/maxresdefault.jpg`,
            }));
          }
        }
      } finally {
        setMetadataLoading(false);
      }
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.sourceUrl, formData.sourceType, titleTouched]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === "sourceType") {
      setFormData((p) => ({
        ...p,
        sourceType: value as any,
        sourceUrl: "",
        title: "",
        thumbnailUrl: "",
      }));
      setError(null);
      setTitleTouched(false);
      return;
    }

    if (name === "title") setTitleTouched(true);
    if (name === "sourceUrl") setTitleTouched(false);

    setFormData((p: any) => ({
      ...p,
      [name]:
        name.includes("_actual") || name.includes("_display") ? Number(value) || 0 : value,
    }));
  };

  const normalizedPreviewSrc = useMemo(() => {
    const src = formData.thumbnailUrl;
    const normalized = normalizeThumbnailUrl(src) || src || "";
    return resolveMediaUrl(normalized) || "";
  }, [formData.thumbnailUrl]);

  const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setUploadingThumbnail(true);
      setError(null);

      const uploadResult = await uploadThumbnail(file);
      const thumbnailUrl = uploadResult?.url || uploadResult?.thumbnailUrl || uploadResult?.thumbnail_url;
      if (!thumbnailUrl) throw new Error("썸네일 업로드에 실패했습니다.");

      setFormData((p) => ({ ...p, thumbnailUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "썸네일 업로드 실패");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const sourceUrl = (formData.sourceUrl || "").trim();

      if (isYouTube) {
        if (!validateYouTubeUrl(sourceUrl)) {
          setError("올바른 YouTube URL 또는 Video ID를 입력해주세요.");
          return;
        }
      }
      if (isFacebook) {
        if (!validateFacebookUrl(sourceUrl)) {
          setError("올바른 Facebook URL을 입력해주세요.");
          return;
        }
      }

      if (!user?.role) throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");

      const userRole = user.role as "admin" | "creator";
      const apiPath = getVideoApiEndpoint(
        userRole,
        mode === "edit" ? String(initialVideo?.id || "") : undefined
      );

      // 최종 썸네일 URL
      const finalThumbnailUrl = (formData.thumbnailUrl || "").trim() || null;

      const basePayload = buildVideoPayload({
        sourceUrl,
        sourceType: formData.sourceType,
        title: formData.title,
        thumbnailUrl: finalThumbnailUrl || undefined,
        description: formData.description,
        language: formData.language || "en",
        creatorName: formData.creatorName || user?.name,
      });

      const payload: any = { ...basePayload };

      // 서버 호환용 키들 보강
      payload.thumbnailUrl = finalThumbnailUrl;
      payload.thumbnail_url = finalThumbnailUrl;
      payload.source_url = sourceUrl;

      // 플랫폼에 따라 적절한 URL 필드 설정
      if (isYouTube) {
        payload.youtube_url = sourceUrl;
        if (sourceUrl && !payload.youtubeId) {
          const youtubeId = extractYoutubeId(sourceUrl);
          if (youtubeId) payload.youtubeId = youtubeId;
        }
      } else if (isFacebook) {
        payload.facebook_url = sourceUrl;
      }

      if (mode === "edit" && userRole === "admin") {
        payload.viewCount = Number(formData.views_actual) || 0;
        payload.likeCount = Number(formData.likes_actual) || 0;
        payload.shareCount = Number(formData.shares_actual) || 0;

        payload.viewDisplay = Number(formData.views_display) || 0;
        payload.likeDisplay = Number(formData.likes_display) || 0;
        payload.shareDisplay = Number(formData.shares_display) || 0;

        // snake_case도 같이
        payload.view_count = payload.viewCount;
        payload.like_count = payload.likeCount;
        payload.share_count = payload.shareCount;

        payload.view_display = payload.viewDisplay;
        payload.like_display = payload.likeDisplay;
        payload.share_display = payload.shareDisplay;
      }

      // apiClient 사용하여 일관된 에러 핸들링 및 Authorization 헤더 자동 포함
      const responseData = mode === "create" 
        ? await apiPost(apiPath, payload)
        : await apiPut(apiPath, payload);
      const rawVideo = responseData.video || responseData.data || responseData;

      const updatedVideo: Video = {
        ...rawVideo,
        managementId: rawVideo.managementId ?? rawVideo.management_id ?? rawVideo.video_code ?? null,
        language: rawVideo.language ?? rawVideo.lang ?? "en",
        viewCountReal: rawVideo.viewCountReal ?? rawVideo.view_count_real ?? rawVideo.views_actual ?? 0,
        viewDisplay: rawVideo.viewDisplay ?? rawVideo.view_display ?? rawVideo.views_display ?? 0,
        likeCountReal: rawVideo.likeCountReal ?? rawVideo.like_count_real ?? rawVideo.likes_actual ?? 0,
        likeDisplay: rawVideo.likeDisplay ?? rawVideo.like_display ?? rawVideo.likes_display ?? 0,
        shareCountReal: rawVideo.shareCountReal ?? rawVideo.share_count_real ?? rawVideo.shares_actual ?? 0,
        shareDisplay: rawVideo.shareDisplay ?? rawVideo.share_display ?? rawVideo.shares_display ?? 0,
      };

      onSaved?.(updatedVideo);
      await onSubmit(updatedVideo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="video-form-modal-overlay" onClick={onClose}>
      <div className="video-form-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-form-modal-close" onClick={onClose}>
          ×
        </button>

        <h2 className="video-form-modal-title">
          {mode === "create" ? "영상 추가" : "영상 편집"}
        </h2>

        {error && (
          <div className="video-form-modal-error">
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="video-form-modal-form">
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
            </select>
          </div>

          <div className="video-form-field">
            <label className="video-form-label">
              {isYouTube ? "YouTube URL 또는 Video ID" : "Facebook URL"}{" "}
              <span className="required">*</span>
            </label>

            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                name="sourceUrl"
                value={formData.sourceUrl}
                onChange={handleChange}
                className="video-form-input"
                placeholder={
                  isYouTube
                    ? "https://www.youtube.com/watch?v=... 또는 Video ID"
                    : "https://www.facebook.com/... 또는 https://fb.watch/..."
                }
                required
                style={{ flex: 1 }}
              />
              {metadataLoading && (
                <button type="button" disabled className="video-form-button-submit">
                  로딩...
                </button>
              )}
            </div>
          </div>

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

          <div className="video-form-field">
            <label className="video-form-label">
              썸네일 {isYouTube ? "URL (자동 생성됨)" : "URL 또는 파일"}
            </label>

            <input
              type="text"
              name="thumbnailUrl"
              value={formData.thumbnailUrl}
              onChange={handleChange}
              className="video-form-input"
              placeholder={isYouTube ? "YouTube 입력 시 자동으로 생성됩니다." : "URL 입력 또는 파일 업로드"}
            />

            {!isYouTube && (
              <div style={{ marginTop: "8px" }}>
                <label className="video-form-label" style={{ fontSize: 14, display: "block" }}>
                  썸네일 파일 업로드
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailFileChange}
                  disabled={uploadingThumbnail}
                />
              </div>
            )}

            {!!normalizedPreviewSrc && (
              <div style={{ marginTop: "8px" }}>
                <span style={{ fontSize: 12, color: "#6b7280", display: "block", marginBottom: 4 }}>
                  미리보기:
                </span>
                <img
                  src={normalizedPreviewSrc}
                  alt="thumbnail preview"
                  style={{
                    maxWidth: 240,
                    maxHeight: 135,
                    borderRadius: 6,
                    border: "1px solid #e5e7eb",
                    objectFit: "contain",
                  }}
                  onError={() => setError("썸네일 이미지를 불러올 수 없습니다. URL을 확인해주세요.")}
                />
              </div>
            )}
          </div>

          <div className="video-form-field">
            <label className="video-form-label">언어</label>
            <select
              name="language"
              value={formData.language || "en"}
              onChange={handleChange}
              className="video-form-select"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

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
