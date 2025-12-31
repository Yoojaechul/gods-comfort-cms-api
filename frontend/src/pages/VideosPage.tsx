import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import VideoTable from "../components/VideoTable";
import BatchUploadModal from "../components/BatchUploadModal";
import { getVideosListApiEndpoint, getBatchDeleteApiEndpoint } from "../lib/videoApi";
import { sortVideosByManagementNumber } from "../utils/videoSort";
import { apiGet, apiPost } from "../lib/apiClient";

export default function VideosPage() {
  const { token, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);

  const isAdmin = user?.role === "admin";
  const basePath = isAdmin ? "/admin" : "/creator";

  useEffect(() => {
    fetchVideos();
    if (searchParams.get("action") === "batch") {
      setShowBatchModal(true);
    }
  }, []);

  const fetchVideos = async () => {
    try {
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다.");
      }
      const userRole = user.role as "admin" | "creator";
      const endpoint = getVideosListApiEndpoint(userRole);
      const data = await apiGet<any>(endpoint);
      
      // API 응답을 항상 배열로 정규화
      const items: any[] = Array.isArray(data) 
        ? data 
        : (data?.items || data?.videos || data?.data || []);
      
      // 관리번호 필드명 표준화 및 정렬
      const normalizedItems = items.map((item: any) => {
        // 관리번호 필드명 표준화: 다양한 필드명을 videoManageNo로 통일
        const rawManageNo = 
          item.videoManageNo || 
          item.video_manage_no || 
          item.manageNo || 
          item.managementNo || 
          item.managementId || 
          item.management_no || 
          item.managementNumber || 
          item.adminCode || 
          item.code || 
          item.video_code || 
          item.management_id || 
          item.adminId || 
          item.admin_id || 
          null;
        
        return {
          ...item,
          videoManageNo: rawManageNo, // 표준 필드명으로 통일
        };
      });
      
      // 관리번호 기준 내림차순 정렬 (최신 영상이 먼저 오도록)
      const sortedVideos = sortVideosByManagementNumber(normalizedItems);
      setVideos(sortedVideos);
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedVideos.length === 0) return;

    try {
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다.");
      }
      const userRole = user.role as "admin" | "creator";
      const endpoint = getBatchDeleteApiEndpoint(userRole);
      await apiPost(endpoint, { video_ids: selectedVideos });
      setSelectedVideos([]);
      fetchVideos();
    } catch (error) {
      console.error("Failed to delete videos:", error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={isAdmin ? "admin" : "creator"}>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={isAdmin ? "admin" : "creator"}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">영상 관리</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBatchModal(true)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              대량 등록
            </button>
            {selectedVideos.length > 0 && (
              <>
                <button
                  onClick={handleBatchDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  선택 삭제 ({selectedVideos.length})
                </button>
              </>
            )}
          </div>
        </div>

        <VideoTable
          videos={videos}
          selectedVideos={selectedVideos}
          onSelectChange={setSelectedVideos}
          isAdmin={isAdmin}
          token={token || ""}
          onRefresh={fetchVideos}
        />

        {showBatchModal && (
          <BatchUploadModal
            onClose={() => {
              setShowBatchModal(false);
              setSearchParams({});
            }}
            onSuccess={() => {
              setShowBatchModal(false);
              fetchVideos();
            }}
            token={token || ""}
            isAdmin={isAdmin}
          />
        )}
      </div>
    </DashboardLayout>
  );
}



































































































