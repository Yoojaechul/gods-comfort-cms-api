import { useState } from "react";
import VideoPreviewModal from "./VideoPreviewModal";

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
  videos: Video[];
  selectedVideos: string[];
  onSelectChange: (ids: string[]) => void;
  isAdmin: boolean;
  token: string;
  onRefresh: () => void;
}

export default function VideoTable({
  videos,
  selectedVideos,
  onSelectChange,
  isAdmin,
  token,
  onRefresh,
}: VideoTableProps) {
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange(videos.map((v) => v.id));
    } else {
      onSelectChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectChange([...selectedVideos, id]);
    } else {
      onSelectChange(selectedVideos.filter((vid) => vid !== id));
    }
  };

  const getThumbnailUrl = (video: Video) => {
    if (video.video_type === "youtube" && video.youtube_id) {
      return `https://img.youtube.com/vi/${video.youtube_id}/hqdefault.jpg`;
    }
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
                  checked={selectedVideos.length === videos.length && videos.length > 0}
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
                등록일
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {videos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  등록된 영상이 없습니다.
                </td>
              </tr>
            ) : (
              videos.map((video) => (
                <tr key={video.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedVideos.includes(video.id)}
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
                    {video.views_display?.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(video.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
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



































