import type { Video } from "../types/video";
import { formatDateTimeKST } from "../utils/date";
import { getLanguageLabel } from "../utils/language";
import { normalizeThumbnailUrl } from "../utils/videoMetadata";
import { getRealPlaybackCount } from "../utils/videoMetrics";
import { CMS_API_BASE } from "../config";
import "./VideoCard.css";

interface VideoCardProps {
  video: Video;
  mode: "creator" | "admin";
  isSelected?: boolean;
  onSelect?: (videoId: string, checked: boolean) => void;
  onView?: (video: Video) => void;
  onEdit?: (video: Video) => void;
  onDelete?: (videoId: string) => void;
}

/**
 * 영상 카드 컴포넌트
 * 요구사항: 목록에서는 "조회수(실제)"만 표시하고, 좋아요/공유는 표시하지 않음.
 */
export default function VideoCard({
  video,
  mode,
  isSelected = false,
  onSelect,
  onView,
  onEdit,
  onDelete,
}: VideoCardProps) {
  // 썸네일 URL (필드명 통일 및 정규화)
  // 다양한 필드명을 확인하여 썸네일 URL 가져오기
  const rawThumbnailUrl = 
    video.thumbnailUrl || 
    (video as any).thumbnail_url || 
    (video as any).thumbnail ||
    (video as any).thumbnailPath ||
    (video as any).thumbnail_path ||
    (video as any).thumbnailFileUrl ||
    (video as any).thumbnail_file_url ||
    (video as any).thumbnailImage ||
    (video as any).thumbnail_image ||
    null;
  const thumbnailUrl = normalizeThumbnailUrl(rawThumbnailUrl, CMS_API_BASE);
  
  // 등록일시 (다양한 필드명 지원)
  const uploadDate = (video as any).created_at || video.uploadedAt || (video as any).upload_date || video.createdAt;
  
  // 목록에서 표시할 "조회수"는 실제 재생수(실제 조회수)만 사용
  const realPlaybackCount = getRealPlaybackCount(video);
  
  // 출처 라벨 가져오기 (우선순위: sourceType > source_type > platform > video_type > videoType > source)
  const getSourceLabel = (): string => {
    const sourceType = 
      (video as any).sourceType || 
      (video as any).source_type || 
      (video as any).platform ||
      (video as any).video_type || 
      (video as any).videoType ||
      (video as any).source;
    
    if (!sourceType) return "-";
    
    const normalized = String(sourceType).toLowerCase();
    if (normalized === "youtube" || normalized === "youtube") return "YouTube";
    if (normalized === "facebook" || normalized === "facebook") return "Facebook";
    if (normalized === "file") return "파일";
    
    // 원본 값이 이미 대문자로 시작하면 그대로 사용
    if (sourceType === "YouTube" || sourceType === "Facebook") {
      return String(sourceType);
    }
    
    return "-";
  };
  
  // 관리번호 가져오기 (표준 필드명 videoManageNo 우선, 기존 필드명들도 지원)
  const getManagementNo = (): string => {
    const candidates = [
      (video as any).videoManageNo,  // 최우선 (표준 필드명, AdminVideosPage에서 정규화됨)
      (video as any).video_manage_no,  // snake_case 버전
      (video as any).videoManagementNo,  // camelCase 버전
      (video as any).video_management_no,  // snake_case 버전
      (video as any).manageNo,
      (video as any).managementNo,
      video.managementId,
      (video as any).management_no,
      (video as any).management_id,
      (video as any).managementNumber,
      (video as any).management_code,
      (video as any).adminCode,
      (video as any).code,
      (video as any).video_code,
      (video as any).adminId,
      (video as any).admin_id,
    ];
    const found = candidates.find(v => v !== null && v !== undefined && String(v).trim() !== "");
    return found ? String(found) : "-";
  };
  
  // 언어 가져오기 (라벨로 변환)
  const getLanguage = (): string => {
    const rawLanguage = video.language || (video as any).lang;
    const label = getLanguageLabel(rawLanguage);
    return label;
  };
  
  const sourceLabel = getSourceLabel();
  const managementNo = getManagementNo();
  const language = getLanguage();
  const formattedDate = formatDateTimeKST(uploadDate);

  return (
    <div className="video-card">
      {/* 체크박스 (admin 모드에서만 표시) */}
      {mode === "admin" && onSelect && (
        <div className="video-card-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(String(video.id), e.target.checked)}
            className="video-card-checkbox-input"
          />
        </div>
      )}
      
      {/* 썸네일 */}
      <div className="video-card-thumbnail">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={video.title} />
        ) : (
          <div className="video-card-thumbnail-placeholder">
            <span className="video-card-thumbnail-icon">🎬</span>
          </div>
        )}
      </div>
      
      {/* 콘텐츠 */}
      <div className="video-card-content">
        {/* 제목 */}
        <h3 className="video-card-title" data-testid="video-card-title">{video.title || "-"}</h3>
        
        {/* 메타 정보: 출처, 영상 관리번호, 언어, 영상 등록일시 */}
        <div className="video-card-meta" data-testid="video-card-meta">
          <span className="video-card-meta-item" data-testid="video-card-source">
            출처: {sourceLabel}
          </span>
          <span className="video-card-meta-item" data-testid="video-card-management-no">
            영상 관리번호: {managementNo}
          </span>
          <span className="video-card-meta-item" data-testid="video-card-language">
            언어: {language}
          </span>
          <span 
            className="video-card-meta-item" 
            data-testid="video-card-upload-date"
            data-formatted-date={formattedDate}
            data-upload-date={uploadDate}
          >
            영상 등록일시: {formattedDate}
          </span>
        </div>
        
        {/* 메트릭스: 조회수(실제)만 표시 */}
        <div className="video-card-metrics">
          <span className="video-card-metric">조회수: {realPlaybackCount.toLocaleString()}</span>
        </div>
      </div>
      
      {/* 액션 버튼 */}
      <div className="video-card-actions">
        {onView && (
          <button
            className="video-card-action-button video-card-action-view"
            onClick={() => onView(video)}
          >
            보기
          </button>
        )}
        {onEdit && (
          <button
            className="video-card-action-button video-card-action-edit"
            onClick={() => onEdit(video)}
          >
            편집
          </button>
        )}
        {onDelete && (
          <button
            className="video-card-action-button video-card-action-delete"
            onClick={() => onDelete(String(video.id))}
          >
            삭제
          </button>
        )}
      </div>
    </div>
  );
}
