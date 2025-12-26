import { useState } from "react";
import VideoPreviewModal from "./VideoPreviewModal";
import { CMS_API_BASE } from "../config";
import { normalizeThumbnailUrl } from "../utils/videoMetadata";
import { getRealPlaybackCount } from "../utils/videoMetrics";

interface Video {
  id: string;
  title: string;
  description?: string;
  language: string;
  video_type: "youtube" | "facebook";
  youtube_id?: string;
  facebook_url?: string;
  creator_id?: string;
  views_actual?: number;
  views_display?: number;
  likes_actual?: number;
  likes_display?: number;
  shares_actual?: number;
  shares_display?: number;
  created_at: string;
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
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);

  // Ensure videos is always an array
  const safeVideos = Array.isArray(videos) ? videos : [];
  const safeSelectedVideos = Array.isArray(selectedVideos) ? selectedVideos : [];

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

  const getThumbnailUrl = (video: Video) => {
    // 썸네일 URL이 있으면 우선 사용 (Facebook/YouTube 구분 없이)
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
    
    // normalizeThumbnailUrl로 정규화 (상대경로를 절대경로로 변환)
    const normalizedThumbnailUrl = normalizeThumbnailUrl(rawThumbnailUrl, CMS_API_BASE);
    
    if (normalizedThumbnailUrl) {
      return normalizedThumbnailUrl;
    }
    
    // YouTube인 경우 기본 썸네일 생성
    if (video.video_type === "youtube" && video.youtube_id) {
      return `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
    }
    
    // 썸네일이 없으면 placeholder
    return "/placeholder-video.jpg";
  };

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={safeSelectedVideos.length === safeVideos.length && safeVideos.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                썸네일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                제목
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                언어
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                플랫폼
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                조회수
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                영상 관리번호
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                등록일
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {safeVideos.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              safeVideos.map((video) => {
                // 관리번호 가져오기 (표준 필드명 videoManageNo 우선, 기존 필드명들도 지원)
                const getManagementNo = (): string => {
                  const candidates = [
                    (video as any).videoManageNo,  // 최우선 (표준 필드명, AdminVideosPage에서 정규화됨)
                    (video as any).video_manage_no,  // snake_case 버전
                    (video as any).videoManagementNo,  // camelCase 버전
                    (video as any).video_management_no,  // snake_case 버전
                    (video as any).manageNo,
                    (video as any).managementNo,
                    (video as any).managementId,
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
                
                return (
                  <tr key={video.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={safeSelectedVideos.includes(video.id)}
                        onChange={(e) => handleSelectOne(video.id, e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div
                        className="relative w-32 h-20 cursor-pointer group"
                        onClick={() => setPreviewVideo(video)}
                      >
                        <img
                          src={getThumbnailUrl(video)}
                          alt={video.title}
                          className="w-full h-full object-cover rounded transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{video.title}</p>
                      {video.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{video.language}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{video.video_type}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getRealPlaybackCount(video).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono">
                      {getManagementNo()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(video.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
          isAdmin={isAdmin}
          token={token}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
}

































































































