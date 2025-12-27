import { useState, useEffect } from "react";
import VideoFormModal from "./admin/VideoFormModal";
import { normalizeThumbnailUrl } from "../utils/videoMetadata";
import { getRealPlaybackCount } from "../utils/videoMetrics";
import { extractYoutubeId } from "../utils/videoMetadata";
import { mapLanguageToEnglish } from "../utils/languageMapper";
import { apiDelete, apiPut } from "../lib/apiClient";
import "./VideoTable.css";

interface Video {
  id: string;
  title?: string | null;
  description?: string;
  language: string;
  video_type: "youtube" | "facebook" | string;
  youtube_id?: string;
  facebook_url?: string;
  creator_id?: string;
  views_actual?: number;
  views_display?: number;
  views_count?: number;
  likes_actual?: number;
  likes_display?: number;
  shares_actual?: number;
  shares_display?: number;
  created_at: string;
  sourceUrl?: string;
  source_url?: string;
  [key: string]: any;
}

interface VideoTableProps {
  videos?: Video[];
  selectedVideos?: string[];
  onSelectChange: (ids: string[]) => void;
  isAdmin: boolean;
  token: string;
  onRefresh: () => void;
}

export default function VideoTable({
  videos = [],
  selectedVideos = [],
  onSelectChange,
  isAdmin,
  token,
  onRefresh,
}: VideoTableProps) {
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [debuggedFirstVideo, setDebuggedFirstVideo] = useState(false);

  // Ensure videos is always an array
  const safeVideos = Array.isArray(videos) ? videos : [];
  const safeSelectedVideos = Array.isArray(selectedVideos) ? selectedVideos : [];

  // 개발 모드에서 첫 번째 video 객체의 키들을 로깅 (한 번만)
  useEffect(() => {
    if (import.meta.env.DEV && safeVideos.length > 0 && !debuggedFirstVideo) {
      const firstVideo = safeVideos[0];
      console.log("[VideoTable Debug] First video object keys:", Object.keys(firstVideo));
      console.log("[VideoTable Debug] First video full object:", firstVideo);
      console.log("[VideoTable Debug] First video management_id:", (firstVideo as any).management_id);
      console.log("[VideoTable Debug] First video managementId:", (firstVideo as any).managementId);
      setDebuggedFirstVideo(true);
    }
  }, [safeVideos, debuggedFirstVideo]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(safeVideos.map((v) => v.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...safeSelectedVideos, id]);
    } else {
      onSelectChange(safeSelectedVideos.filter((vid) => vid !== id));
    }
  };

  // 관리번호 가져오기 (우선순위: management_id → managementId)
  const getManagementNo = (video: Video): string => {
    // 우선순위 1: management_id
    const management_id = (video as any).management_id;
    if (management_id !== null && management_id !== undefined && management_id !== "") {
      const value = String(management_id).trim();
      if (value !== "") {
        return value;
      }
    }
    
    // 우선순위 2: managementId
    const managementId = (video as any).managementId;
    if (managementId !== null && managementId !== undefined && managementId !== "") {
      const value = String(managementId).trim();
      if (value !== "") {
        return value;
      }
    }
    
    // 둘 다 없으면 '-' 표시
    return "-";
  };

  // 썸네일 URL 가져오기
  const getThumbnailUrl = (video: Video): string | null => {
    const rawThumbnailUrl = 
      (video as any).thumbnailUrl || 
      (video as any).thumbnail_url || 
      (video as any).thumbnail ||
      (video as any).thumbnailPath ||
      (video as any).thumbnail_path ||
      (video as any).thumbnailFileUrl ||
      (video as any).thumbnail_file_url ||
      (video as any).thumbnailImage ||
      (video as any).thumbnail_image ||
      null;
    
    const normalizedThumbnailUrl = normalizeThumbnailUrl(rawThumbnailUrl);
    
    if (normalizedThumbnailUrl) {
      return normalizedThumbnailUrl;
    }
    
    // YouTube인 경우 기본 썸네일 생성
    if ((video.video_type === "youtube" || (video as any).sourceType === "youtube") && video.youtube_id) {
      return `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
    }
    
    // YouTube sourceUrl에서 추출
    if ((video.video_type === "youtube" || (video as any).sourceType === "youtube")) {
      const sourceUrl = video.sourceUrl || (video as any).source_url;
      if (sourceUrl) {
        const youtubeId = extractYoutubeId(sourceUrl);
        if (youtubeId) {
          return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
        }
      }
    }
    
    return null;
  };

  // 제목 가져오기 (null이면 [PLATFORM] video_id 형태로 표시, source_url은 직접 표시하지 않음)
  const getTitle = (video: Video): string => {
    // title이 있으면 사용
    if (video.title && String(video.title).trim() !== "") {
      return video.title;
    }
    
    // platform과 video_id 조합
    const platform = video.video_type || (video as any).sourceType || (video as any).platform || "";
    let videoId = video.youtube_id || (video as any).video_id || "";
    
    // video_id가 없으면 source_url에서 추출 시도 (YouTube만)
    if (!videoId) {
      const sourceUrl = video.sourceUrl || (video as any).source_url;
      if (sourceUrl && (platform === "youtube" || (video as any).sourceType === "youtube")) {
        const extractedId = extractYoutubeId(sourceUrl);
        if (extractedId) {
          videoId = extractedId;
        }
      }
    }
    
    // [PLATFORM] video_id 형태로 반환
    if (platform && videoId) {
      return `[${platform.toUpperCase()}] ${videoId}`.trim();
    }
    
    if (platform) {
      return `[${platform.toUpperCase()}]`;
    }
    
    return "제목 없음";
  };

  // 미리보기 URL 가져오기 (embed_url 또는 source_url 기반으로 생성)
  const getPreviewUrl = (video: Video): string | null => {
    // embed_url이 있으면 사용
    const embedUrl = (video as any).embed_url || (video as any).embedUrl;
    if (embedUrl && String(embedUrl).trim() !== "") {
      return embedUrl;
    }
    
    // YouTube인 경우 embed URL 생성
    if (video.video_type === "youtube" || (video as any).sourceType === "youtube") {
      const youtubeId = video.youtube_id || extractYoutubeId(video.sourceUrl || (video as any).source_url || "");
      if (youtubeId) {
        return `https://www.youtube.com/embed/${youtubeId}`;
      }
    }
    
    // source_url 사용 (Facebook 등)
    const sourceUrl = video.sourceUrl || (video as any).source_url;
    if (sourceUrl && String(sourceUrl).trim() !== "") {
      return sourceUrl;
    }
    
    return null;
  };

  // 미리보기 버튼 클릭 핸들러 (새 팝업 창)
  const handlePreviewClick = (video: Video) => {
    const previewUrl = getPreviewUrl(video);
    if (previewUrl) {
      window.open(
        previewUrl,
        "_blank",
        "width=980,height=580,noopener,noreferrer"
      );
    }
  };

  // 조회수 가져오기
  const getViewsCount = (video: Video): number => {
    return (video as any).views_count || 
           video.views_actual || 
           video.views_display || 
           getRealPlaybackCount(video) || 
           0;
  };

  // 삭제 핸들러
  const handleDelete = async (videoId: string) => {
    if (!window.confirm("정말 이 영상을 삭제하시겠습니까?")) {
      return;
    }

    setDeletingVideoId(videoId);
    try {
      await apiDelete(`/creator/videos/${videoId}`);
      await onRefresh();
    } catch (error: any) {
      console.error("[VideoTable] Failed to delete video:", error);
      alert(error?.message || "영상 삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingVideoId(null);
    }
  };

  return (
    <>
      <div className="video-table-container">
        <table className="video-table">
          <thead>
            <tr>
              <th className="video-table-checkbox-cell">
                <input
                  type="checkbox"
                  checked={safeSelectedVideos.length === safeVideos.length && safeVideos.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="video-table-management-no-cell">
                영상<br />관리번호
              </th>
              <th className="video-table-thumbnail-cell">썸네일</th>
              <th className="video-table-title-cell">제목</th>
              <th className="video-table-language-cell">언어</th>
              <th className="video-table-platform-cell">플랫폼</th>
              <th className="video-table-views-cell">조회수</th>
              <th className="video-table-preview-cell">미리보기</th>
              <th className="video-table-action-cell">수정</th>
              <th className="video-table-action-cell">삭제</th>
            </tr>
          </thead>
          <tbody>
            {safeVideos.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              safeVideos.map((video) => {
                const thumbnailUrl = getThumbnailUrl(video);
                const title = getTitle(video);
                const managementNo = getManagementNo(video);
                const viewsCount = getViewsCount(video);
                const previewUrl = getPreviewUrl(video);
                const language = mapLanguageToEnglish(video.language);
                const platform = video.video_type || (video as any).sourceType || (video as any).platform || "-";
                const isDeleting = deletingVideoId === video.id;
                
                return (
                  <tr key={video.id}>
                    <td className="video-table-checkbox-cell">
                      <input
                        type="checkbox"
                        checked={safeSelectedVideos.includes(video.id)}
                        onChange={(e) => handleSelectOne(video.id, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="video-table-management-no-cell">
                      {managementNo}
                    </td>
                    <td className="video-table-thumbnail-cell">
                      <div className="video-table-thumbnail-wrapper">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt={title}
                            className="video-table-thumbnail-image"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = "none";
                              const placeholder = target.parentElement?.querySelector(".video-table-thumbnail-placeholder");
                              if (placeholder) {
                                (placeholder as HTMLElement).style.display = "flex";
                              }
                            }}
                          />
                        ) : null}
                        <div 
                          className="video-table-thumbnail-placeholder"
                          style={{ display: thumbnailUrl ? "none" : "flex" }}
                        >
                          No Image
                        </div>
                      </div>
                    </td>
                    <td className="video-table-title-cell">
                      <p className="video-table-title-text" title={title} style={{ textAlign: 'center' }}>
                        {title}
                      </p>
                    </td>
                    <td className="video-table-language-cell">
                      {language}
                    </td>
                    <td className="video-table-platform-cell">
                      {platform}
                    </td>
                    <td className="video-table-views-cell">
                      {viewsCount.toLocaleString()}
                    </td>
                    <td className="video-table-preview-cell">
                      {previewUrl ? (
                        <button
                          className="video-table-action-button video-table-preview-button"
                          onClick={() => handlePreviewClick(video)}
                          title="새 창에서 미리보기"
                        >
                          미리보기
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="video-table-action-cell">
                      <button
                        className="video-table-action-button video-table-edit-button"
                        onClick={() => setEditingVideo(video)}
                        title="수정"
                      >
                        수정
                      </button>
                    </td>
                    <td className="video-table-action-cell">
                      <button
                        className="video-table-action-button video-table-delete-button"
                        onClick={() => handleDelete(video.id)}
                        disabled={isDeleting}
                        title="삭제"
                      >
                        {isDeleting ? "삭제 중..." : "삭제"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {editingVideo && (
        <VideoFormModal
          mode="edit"
          initialVideo={editingVideo as any}
          onClose={() => setEditingVideo(null)}
          onSubmit={async () => {
            setEditingVideo(null);
            await onRefresh();
          }}
          onSaved={async () => {
            setEditingVideo(null);
            await onRefresh();
          }}
        />
      )}
    </>
  );
}
