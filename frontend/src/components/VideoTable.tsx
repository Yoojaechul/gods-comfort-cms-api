import { useState, useEffect } from "react";
import VideoFormModal from "./admin/VideoFormModal";
import { normalizeThumbnailUrl, extractYoutubeId, extractYouTubeIdFromVideo } from "../utils/videoMetadata";
import { getRealPlaybackCount } from "../utils/videoMetrics";
import { mapLanguageToEnglish } from "../utils/languageMapper";
import { apiDelete } from "../lib/apiClient";
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

/**
 * ✅ YouTube 전용: 새 창을 about:blank로 열고, 그 안에 iframe을 주입해서 "영상만" 재생되게 합니다.
 * - (중요) embed URL을 새 창의 location으로 직접 열면 YouTube 오류 153이 뜰 수 있음
 * - 이 방식은 embed가 "iframe 내부"에서 로드되므로 안정적으로 재생됩니다.
 */
function openYouTubePlayerPopup(youtubeId: string, title?: string) {
  const width = 980;
  const height = 580;

  // (중요) noopener/noreferrer를 넣으면 popup.document 접근이 막힐 수 있어 제거합니다.
  const popup = window.open(
    "about:blank",
    "_blank",
    `width=${width},height=${height},resizable=yes,scrollbars=no`
  );

  if (!popup) {
    alert("팝업이 차단되었습니다. 브라우저에서 팝업 허용 후 다시 시도해 주세요.");
    return;
  }

  // YouTube embed (iframe 내부 재생)
  const origin = encodeURIComponent(window.location.origin);
  const embedUrl =
    `https://www.youtube.com/embed/${youtubeId}` +
    `?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1&origin=${origin}`;

  const safeTitle = (title || `YouTube Preview - ${youtubeId}`).replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    html, body {
      margin: 0; padding: 0;
      width: 100%; height: 100%;
      background: #000;
      overflow: hidden;
    }
    .wrap {
      width: 100%; height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #000;
    }
    iframe {
      border: 0;
      width: 100%;
      height: 100%;
      display: block;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <iframe
      src="${embedUrl}"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen
    ></iframe>
  </div>
</body>
</html>`;

  try {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } catch (e) {
    console.error("[YouTube Popup] Failed to write popup HTML:", e);
    // fallback: 그래도 새 창에서 YouTube watch로 열기
    popup.location.href = `https://www.youtube.com/watch?v=${youtubeId}`;
  }
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

    // YouTube인 경우 기본 썸네일 생성 (개선된 YouTube ID 추출 함수 사용)
    if (video.video_type === "youtube" || (video as any).sourceType === "youtube") {
      const youtubeId = extractYouTubeIdFromVideo(video);
      if (youtubeId) {
        return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
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

    // video_id가 없으면 개선된 함수로 추출 시도 (YouTube만)
    if (!videoId && (platform === "youtube" || (platform as string).toLowerCase().includes("youtube"))) {
      const extractedId = extractYouTubeIdFromVideo(video);
      if (extractedId) {
        videoId = extractedId;
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

  // 조회수 가져오기 (view_count 또는 views 필드 지원)
  const getViewsCount = (video: Video): number => {
    return (
      (video as any).view_count ||
      (video as any).views_count ||
      (video as any).views ||
      video.views_actual ||
      video.views_display ||
      getRealPlaybackCount(video) ||
      0
    );
  };

  /**
   * ✅ 미리보기 버튼 클릭 핸들러
   * - YouTube: "영상만" 나오는 팝업(about:blank + iframe 주입)으로 재생
   * - Facebook/기타: 기존처럼 URL 새 창으로 오픈
   */
  const handlePreviewClick = (video: Video) => {
    const platform = video.video_type || (video as any).sourceType || (video as any).platform || "";
    const title = getTitle(video);

    // ✅ YouTube는 popup에 iframe로 재생
    if (platform === "youtube" || platform.toLowerCase().includes("youtube")) {
      // youtube_url 필드 우선 확인
      const youtubeUrl = (video as any).youtube_url;
      let youtubeId: string | null = null;
      
      if (youtubeUrl) {
        youtubeId = extractYoutubeId(youtubeUrl);
      }
      
      // youtube_url에서 찾지 못하면 기존 로직 사용
      if (!youtubeId) {
        youtubeId = extractYouTubeIdFromVideo(video);
      }

      if (!youtubeId) {
        alert("YouTube ID를 찾을 수 없습니다. youtube_url/source_url/youtube_id를 확인해 주세요.");
        return;
      }

      openYouTubePlayerPopup(youtubeId, title);
      return;
    }

    // ✅ Facebook은 facebook_url 우선, 없으면 url 또는 source_url 사용
    if (platform === "facebook" || platform.toLowerCase().includes("facebook")) {
      const sourceUrl =
        (video as any).facebook_url ||
        (video as any).url ||
        video.sourceUrl ||
        (video as any).source_url ||
        "";
      if (sourceUrl && String(sourceUrl).trim() !== "") {
        window.open(sourceUrl, "_blank", "width=980,height=580,noopener,noreferrer");
        return;
      }
      alert("미리보기 URL을 찾을 수 없습니다.");
      return;
    }

    // ✅ 기타 플랫폼은 URL 그대로 새 창
    const sourceUrl = video.sourceUrl || (video as any).source_url || "";
    if (sourceUrl && String(sourceUrl).trim() !== "") {
      window.open(sourceUrl, "_blank", "width=980,height=580,noopener,noreferrer");
      return;
    }

    alert("미리보기 URL을 찾을 수 없습니다.");
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
                    <td className="video-table-management-no-cell">{managementNo}</td>
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
                              const placeholder =
                                target.parentElement?.querySelector(".video-table-thumbnail-placeholder");
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
                      <p className="video-table-title-text" title={title} style={{ textAlign: "center" }}>
                        {title}
                      </p>
                    </td>
                    <td className="video-table-language-cell">{language}</td>
                    <td className="video-table-platform-cell">{platform}</td>
                    <td className="video-table-views-cell">{viewsCount.toLocaleString()}</td>

                    <td className="video-table-preview-cell">
                      <button
                        className="video-table-action-button video-table-preview-button"
                        onClick={() => handlePreviewClick(video)}
                        title="새 창에서 미리보기"
                      >
                        미리보기
                      </button>
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



