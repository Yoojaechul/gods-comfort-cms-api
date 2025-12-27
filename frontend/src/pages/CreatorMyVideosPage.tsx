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
      // ✅ Creator 영상 목록 API: POST /creator/videos (토큰은 apiClient가 자동으로 Authorization 헤더에 추가)
      const data = await apiGet<any>("/creator/videos");

      // API 응답 형식: {"videos":[...]} 또는 배열 직접 반환
      let list: Video[] = [];
      if (Array.isArray(data)) {
        // 배열이 직접 반환된 경우
        list = data;
      } else if (data && typeof data === 'object') {
        // 객체인 경우 videos 필드 우선 확인 (가장 일반적인 응답 형식)
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
      console.error("[CreatorMyVideosPage] Failed to load videos:", e);
      setVideos([]);
      
      // 에러 메시지 추출 및 사용자 친화적으로 변환
      const errorMsg = e?.message || "영상 목록을 불러오는 중 오류가 발생했습니다.";
      
      // 401/403 인증 오류
      if (e?.status === 401 || e?.status === 403 || errorMsg.includes("권한") || errorMsg.includes("인증")) {
        setError("로그인이 필요합니다. 다시 로그인해주세요.");
      }
      // 404 오류
      else if (e?.status === 404 || errorMsg.includes("404")) {
        setError("영상 목록을 불러올 수 없습니다. API 서버를 확인해주세요.");
      }
      // 네트워크 오류
      else if (errorMsg.includes("Failed to fetch") || errorMsg.includes("Network")) {
        setError("네트워크 오류가 발생했습니다. 연결을 확인해주세요.");
      }
      // 기타 오류
      else {
        // 사용자에게 불필요한 기술적 세부사항 제거
        const cleanMsg = errorMsg
          .replace(/\|.*$/g, "") // "| URL: ..." 같은 디버깅 정보 제거
          .replace(/URL:.*/g, "") // URL 정보 제거
          .trim();
        setError(cleanMsg || "영상 목록을 불러오는 중 오류가 발생했습니다.");
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
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <VideoTable
            videos={videos || []}
            selectedVideos={selectedVideos}
            onSelectChange={setSelectedVideos}
            isAdmin={false}
            token={token || ""}
            onRefresh={loadMyVideos}
          />
        </div>
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

