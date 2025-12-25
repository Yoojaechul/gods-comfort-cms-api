// frontend/src/pages/CreatorMyVideosPage.tsx
import { useEffect, useMemo, useState } from "react";
import type { Video } from "../types/video";
import { apiGet } from "../lib/apiClient";
import { useAuth } from "../contexts/AuthContext";

import VideoFormModal from "../components/admin/VideoFormModal";
import BulkVideosModal from "../components/admin/BulkVideosModal";
import VideoTable from "../components/VideoTable";

export default function CreatorMyVideosPage() {
  const { token, user, loading: authLoading } = useAuth();

  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showVideoFormModal, setShowVideoFormModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const canUse = useMemo(() => Boolean(token && user), [token, user]);

  const loadMyVideos = async () => {
    if (!canUse) return;

    setLoading(true);
    setError(null);

    try {
      // ✅ 토큰은 apiClient가 localStorage에서 가져가서 Authorization 붙임
      const data = await apiGet<any>("/creator/videos");

      // Safe array extraction with multiple fallbacks
      let list: Video[] = [];
      if (Array.isArray(data)) {
        list = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.videos)) {
          list = data.videos;
        } else if (Array.isArray(data.data)) {
          list = data.data;
        } else if (Array.isArray(data.items)) {
          list = data.items;
        }
      }
      
      // Ensure list is always an array
      setVideos(Array.isArray(list) ? list : []);
    } catch (e: any) {
      console.error("Failed to load videos:", e);
      setVideos([]);
      
      // HTML 응답 에러 메시지 처리
      const errorMsg = e?.message || "목록을 불러오지 못했습니다.";
      if (errorMsg.includes("API endpoint mismatch") || errorMsg.includes("received HTML")) {
        setError("API endpoint mismatch (received HTML). Check API_BASE_URL.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) loadMyVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse, authLoading]);

  if (authLoading) {
    return <div style={{ padding: 18 }}>인증 확인 중...</div>;
  }

  return (
    <div style={{ padding: "18px 18px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>My Videos</h2>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShowVideoFormModal(true)}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            영상 추가
          </button>

          <button
            onClick={() => setShowBulkModal(true)}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            대량 등록/편집
          </button>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {error && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "10px 12px",
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 18 }}>불러오는 중...</div>
      ) : (
        <VideoTable
          videos={videos || []}
          selectedVideos={selectedVideos}
          onSelectChange={setSelectedVideos}
          isAdmin={false}
          token={token || ""}
          onRefresh={loadMyVideos}
        />
      )}

      {showVideoFormModal && (
        <VideoFormModal
          mode="create"
          initialVideo={null}
          onClose={() => setShowVideoFormModal(false)}
          onSubmit={async () => {
            await loadMyVideos();
          }}
          onSaved={async () => {
            await loadMyVideos();
          }}
        />
      )}

      {showBulkModal && (
        <BulkVideosModal
          onClose={() => setShowBulkModal(false)}
          onSuccess={async () => {
            setShowBulkModal(false);
            await loadMyVideos();
          }}
        />
      )}
    </div>
  );
}

