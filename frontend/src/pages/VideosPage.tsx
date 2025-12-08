import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import VideoTable from "../components/VideoTable";
import BatchUploadModal from "../components/BatchUploadModal";

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
      const endpoint = isAdmin ? "/admin/videos" : "/videos";
      const response = await fetch(`${CMS_API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error("Failed to fetch videos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedVideos.length === 0) return;

    try {
      const endpoint = isAdmin ? "/admin/videos/batch-delete" : "/videos/batch-delete";
      await fetch(`${CMS_API_BASE}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ video_ids: selectedVideos }),
      });
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



































