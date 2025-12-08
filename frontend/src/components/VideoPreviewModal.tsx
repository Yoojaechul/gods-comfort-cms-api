import { useEffect } from "react";
import { createPortal } from "react-dom";

interface Video {
  id: string | number;
  title: string;
  video_type: "youtube" | "facebook" | "file";
  youtube_id?: string;
  facebook_url?: string;
  sourceUrl?: string;
  sourceType?: string;
}

interface VideoPreviewModalProps {
  video: Video;
  onClose: () => void;
}

export default function VideoPreviewModal({
  video,
  onClose,
}: VideoPreviewModalProps) {

  // YouTube Video ID 추출 함수
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    
    // 이미 ID만 있는 경우
    if (!url.includes("http") && !url.includes("www")) {
      return url;
    }
    
    // youtube.com/watch?v=ID
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (watchMatch) {
      return watchMatch[1];
    }
    
    // youtube.com/embed/ID
    const embedMatch = url.match(/youtube\.com\/embed\/([^&\n?#]+)/);
    if (embedMatch) {
      return embedMatch[1];
    }
    
    return null;
  };

  const getEmbedUrl = () => {
    // YouTube 처리
    if (video.video_type === "youtube" || video.sourceType === "youtube") {
      let videoId: string | null = null;
      
      // youtube_id가 있으면 사용
      if (video.youtube_id) {
        videoId = video.youtube_id;
      } 
      // sourceUrl에서 추출 시도
      else if (video.sourceUrl || (video as any).source_url || (video as any).url) {
        videoId = extractYouTubeId(video.sourceUrl || (video as any).source_url || (video as any).url);
      }
      
      if (videoId) {
        return { type: "youtube", url: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1` };
      }
    }
    
    // Facebook 처리
    if (video.video_type === "facebook" || video.sourceType === "facebook") {
      const facebookUrl = video.facebook_url || video.sourceUrl || (video as any).source_url || (video as any).url;
      if (facebookUrl) {
        // Facebook URL 인코딩
        const encodedUrl = encodeURIComponent(facebookUrl);
        // 자동재생 + 음소거 + 텍스트 숨김
        return { type: "facebook", url: `https://www.facebook.com/plugins/video.php?href=${encodedUrl}&autoplay=1&mute=1&show_text=false` };
      }
    }
    
    // File 처리
    if (video.video_type === "file" || video.sourceType === "file") {
      const fileUrl = video.sourceUrl || (video as any).source_url || (video as any).url;
      if (fileUrl) {
        return { type: "file", url: fileUrl };
      }
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl();

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // 배경 클릭 핸들러
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          maxWidth: "900px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", color: "#1a1a1a", margin: 0 }}>영상 미리보기</h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                color: "#999",
                cursor: "pointer",
                padding: "4px",
                lineHeight: 1,
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#333")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#999")}
            >
              ✕
            </button>
          </div>

          {/* 영상 제목 */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#1a1a1a", margin: 0 }}>
              {video.title}
            </h3>
          </div>

          {/* 영상 플레이어 */}
          {embedUrl ? (
            <div>
              {embedUrl.type === "file" ? (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", backgroundColor: "#000" }}>
                  <video
                    src={embedUrl.url}
                    controls
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              ) : (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                  <iframe
                    src={embedUrl.url}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: "32px", backgroundColor: "#f3f4f6", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ color: "#4b5563" }}>영상을 재생할 수 없습니다. 유효한 URL을 확인해주세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  return createPortal(modalContent, document.body);
}












