import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { loadFacebookSDK, parseXFBML } from "../utils/facebookSdk";

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
  const facebookContainerRef = useRef<HTMLDivElement>(null);
  const facebookIframeRef = useRef<HTMLIFrameElement>(null);
  const [facebookUrl, setFacebookUrl] = useState<string | null>(null);
  const [isFacebookLoading, setIsFacebookLoading] = useState(false);
  const [facebookLoadError, setFacebookLoadError] = useState<string | null>(null);
  const [useXFBML, setUseXFBML] = useState(false); // iframe 실패 시 XFBML 사용

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

  // Facebook URL 정규화 (watch/reels/video.php 모두 처리)
  const normalizeFacebookUrl = (url: string): string => {
    if (!url || !url.trim()) return url;
    
    const trimmed = url.trim();
    
    // 이미 http:// 또는 https://로 시작하면 그대로 사용
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    
    // facebook.com 또는 fb.watch로 시작하면 https:// 추가
    if (trimmed.startsWith("facebook.com/") || trimmed.startsWith("www.facebook.com/") || trimmed.startsWith("fb.watch/")) {
      return `https://${trimmed}`;
    }
    
    // 그 외의 경우 https://를 앞에 붙임
    return `https://${trimmed}`;
  };

  // Facebook URL 추출 (디버깅 로그 포함)
  const getFacebookUrl = (): string | null => {
    const isFacebook = video.video_type === "facebook" || video.sourceType === "facebook";
    
    if (!isFacebook) {
      return null;
    }
    
    // 디버깅: video 객체의 모든 Facebook 관련 필드 로그
    console.log('[VideoPreviewModal] Facebook 영상 디버깅:', {
      video_type: video.video_type,
      sourceType: video.sourceType,
      facebook_url: video.facebook_url,
      sourceUrl: video.sourceUrl,
      source_url: (video as any).source_url,
      url: (video as any).url,
      전체_video_객체: video,
    });
    
    const rawUrl = video.facebook_url || video.sourceUrl || (video as any).source_url || (video as any).url || null;
    
    if (!rawUrl) {
      console.warn('[VideoPreviewModal] Facebook URL을 찾을 수 없습니다.');
      return null;
    }
    
    // URL 정규화 (watch/reels/video.php 모두 처리)
    const normalizedUrl = normalizeFacebookUrl(rawUrl);
    console.log('[VideoPreviewModal] 원본 Facebook URL:', rawUrl);
    console.log('[VideoPreviewModal] 정규화된 Facebook URL:', normalizedUrl);
    
    return normalizedUrl;
  };

  // YouTube URL 추출
  const getYouTubeEmbedUrl = (): string | null => {
    if (video.video_type === "youtube" || video.sourceType === "youtube") {
      let videoId: string | null = null;
      
      if (video.youtube_id) {
        videoId = video.youtube_id;
      } else if (video.sourceUrl || (video as any).source_url || (video as any).url) {
        videoId = extractYouTubeId(video.sourceUrl || (video as any).source_url || (video as any).url);
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1`;
      }
    }
    return null;
  };

  // File URL 추출
  const getFileUrl = (): string | null => {
    if (video.video_type === "file" || video.sourceType === "file") {
      return video.sourceUrl || (video as any).source_url || (video as any).url || null;
    }
    return null;
  };

  const youtubeUrl = getYouTubeEmbedUrl();
  const fileUrl = getFileUrl();
  const currentFacebookUrl = getFacebookUrl();

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // XFBML로 fallback (useEffect보다 먼저 선언하여 호이스팅 문제 해결)
  const fallbackToXFBML = useCallback(() => {
    console.log('[VideoPreviewModal] XFBML로 fallback');
    setUseXFBML(true);
    setIsFacebookLoading(true);

    const fbUrl = currentFacebookUrl;
    if (!fbUrl) {
      setIsFacebookLoading(false);
      return;
    }

    // Facebook SDK 로드 및 XFBML 파싱 (안전장치 추가)
    loadFacebookSDK()
      .then(() => {
        // SDK 로드 후 window.FB 확인
        if (!window.FB || !window.FB.XFBML) {
          console.error('[VideoPreviewModal] Facebook SDK가 로드되었지만 window.FB.XFBML이 없습니다.');
          setIsFacebookLoading(false);
          setFacebookLoadError("Facebook SDK를 초기화할 수 없습니다.");
          if (facebookContainerRef.current) {
            facebookContainerRef.current.innerHTML = `<p style="color: #ef4444; padding: 16px;">Facebook SDK 초기화 실패</p>`;
          }
          return;
        }

        if (!facebookContainerRef.current || !fbUrl) {
          setIsFacebookLoading(false);
          return;
        }

        // XFBML 마크업 주입
        const xfbmlMarkup = `
          <div class="fb-video"
               data-href="${fbUrl}"
               data-width="560"
               data-show-text="false"
               data-autoplay="false"
               data-allowfullscreen="true"></div>
        `;
        
        facebookContainerRef.current.innerHTML = xfbmlMarkup;
        
        // XFBML 파싱 (안전하게)
        try {
          if (window.FB && window.FB.XFBML && window.FB.XFBML.parse) {
            window.FB.XFBML.parse(facebookContainerRef.current);
          } else {
            console.warn('[VideoPreviewModal] window.FB.XFBML.parse를 사용할 수 없습니다.');
            parseXFBML(facebookContainerRef.current);
          }
        } catch (parseError) {
          console.error('[VideoPreviewModal] XFBML 파싱 중 오류:', parseError);
          setFacebookLoadError("Facebook 영상 파싱에 실패했습니다.");
        }
        
        setIsFacebookLoading(false);
      })
      .catch((error) => {
        console.error("Facebook SDK 로드 실패:", error);
        setIsFacebookLoading(false);
        setFacebookLoadError("Facebook 영상을 로드할 수 없습니다.");
        if (facebookContainerRef.current) {
          facebookContainerRef.current.innerHTML = `<p style="color: #ef4444; padding: 16px;">Facebook 영상을 로드할 수 없습니다.</p>`;
        }
      });
  }, [currentFacebookUrl]);

  // Facebook 영상 처리: iframe 우선 시도, 실패 시 XFBML fallback
  useEffect(() => {
    const isFacebook = video.video_type === "facebook" || video.sourceType === "facebook";
    
    if (!isFacebook || !currentFacebookUrl) {
      // Facebook이 아니면 컨테이너 비우기
      if (facebookContainerRef.current) {
        facebookContainerRef.current.innerHTML = "";
      }
      setFacebookUrl(null);
      setIsFacebookLoading(false);
      setFacebookLoadError(null);
      setUseXFBML(false);
      return;
    }

    // Facebook URL이 변경되었을 때만 처리
    if (facebookUrl === currentFacebookUrl && !useXFBML) {
      return;
    }

    // 컨테이너 비우기 및 상태 초기화
    if (facebookContainerRef.current) {
      facebookContainerRef.current.innerHTML = "";
    }
    setFacebookLoadError(null);
    setUseXFBML(false);

    setFacebookUrl(currentFacebookUrl);
    setIsFacebookLoading(true);

    // iframe 로드 실패 감지 (5초 후에도 로드되지 않으면 에러 표시)
    const loadCheckTimer = setTimeout(() => {
      if (!useXFBML && isFacebookLoading) {
        console.warn('[VideoPreviewModal] iframe 로드 타임아웃 (5초)');
        setFacebookLoadError("iframe 로드 시간 초과. 브라우저 보안 설정 또는 비공개 영상일 수 있습니다.");
        setIsFacebookLoading(false);
      }
    }, 5000);

    // iframe은 직접 렌더링하므로 여기서는 상태만 설정
    setIsFacebookLoading(false);

    return () => {
      clearTimeout(loadCheckTimer);
    };
  }, [video.video_type, video.sourceType, currentFacebookUrl, facebookUrl, useXFBML, fallbackToXFBML]);

  // 모달이 닫힐 때 Facebook 컨테이너 비우기
  useEffect(() => {
    return () => {
      if (facebookContainerRef.current) {
        facebookContainerRef.current.innerHTML = "";
      }
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
          {(() => {
            // YouTube 처리
            if (youtubeUrl) {
              return (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                  <iframe
                    src={youtubeUrl}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
                    allowFullScreen
                    allow="autoplay; encrypted-media"
                  />
                </div>
              );
            }

            // Facebook 처리 (iframe 우선, 실패 시 XFBML)
            if (currentFacebookUrl) {
              const pluginUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(currentFacebookUrl)}&show_text=0&width=560`;
              
              return (
                <div style={{ marginBottom: "16px" }}>
                  {isFacebookLoading && (
                    <div style={{ padding: "32px", backgroundColor: "#f3f4f6", borderRadius: "8px", textAlign: "center" }}>
                      <p style={{ color: "#4b5563" }}>Facebook 영상을 로드하는 중...</p>
                </div>
              )}
                  
                  {!useXFBML ? (
                    // iframe 방식 (우선 시도)
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px" }}>
                      <iframe
                        ref={facebookIframeRef}
                        src={pluginUrl}
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                        allowFullScreen
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        onLoad={() => {
                          // iframe 로드 성공
                          console.log('[VideoPreviewModal] Facebook iframe 로드 성공');
                          setIsFacebookLoading(false);
                          setFacebookLoadError(null);
                        }}
                        onError={() => {
                          // iframe 로드 실패 (3rd-party 쿠키 차단 등)
                          console.warn('[VideoPreviewModal] Facebook iframe 로드 실패 (onError)');
                          setFacebookLoadError("iframe 로드 실패. 브라우저 보안 설정 또는 비공개 영상일 수 있습니다.");
                          setIsFacebookLoading(false);
                        }}
                      />
                      <button
                        onClick={fallbackToXFBML}
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "8px",
                          padding: "4px 8px",
                          fontSize: "12px",
                          backgroundColor: "rgba(0,0,0,0.6)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                        title="iframe이 로드되지 않으면 클릭하여 XFBML 방식으로 시도"
                      >
                        XFBML로 시도
                      </button>
            </div>
          ) : (
                    // XFBML 방식 (fallback)
                    <div
                      ref={facebookContainerRef}
                      style={{
                        minHeight: "315px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    />
                  )}
                  
                  {/* Facebook에서 열기 버튼 (항상 표시) */}
                  <div style={{ marginTop: "12px", textAlign: "center" }}>
                    <a
                      href={currentFacebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: facebookLoadError ? "10px 20px" : "6px 12px",
                        backgroundColor: facebookLoadError ? "#1877f2" : "transparent",
                        color: facebookLoadError ? "white" : "#1877f2",
                        textDecoration: "none",
                        fontSize: facebookLoadError ? "15px" : "14px",
                        borderRadius: "4px",
                        fontWeight: facebookLoadError ? "600" : "400",
                        border: facebookLoadError ? "none" : "1px solid #1877f2",
                      }}
                    >
                      {facebookLoadError ? "🔗 Facebook에서 열기 (권장)" : "Facebook에서 열기 →"}
                    </a>
                  </div>
                  
                  {facebookLoadError && (
                    <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "#fff3cd", borderRadius: "8px", fontSize: "13px", color: "#856404" }}>
                      <p style={{ margin: "0 0 8px 0", fontWeight: "500" }}>⚠️ 영상 재생 불가 안내</p>
                      <ul style={{ margin: "0", paddingLeft: "20px" }}>
                        <li>비공개 또는 친구 공개 영상은 embed가 지원되지 않습니다.</li>
                        <li>브라우저 보안 설정(3rd-party 쿠키 차단)으로 embed가 차단될 수 있습니다.</li>
                        <li>위의 "Facebook에서 열기" 버튼을 클릭하여 Facebook에서 직접 시청하세요.</li>
                      </ul>
                    </div>
                  )}
                </div>
              );
            }

            // File 처리
            if (fileUrl) {
              return (
                <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "8px", backgroundColor: "#000" }}>
                  <video
                    src={fileUrl}
                    controls
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </div>
              );
            }

            // 영상 없음
            return (
            <div style={{ padding: "32px", backgroundColor: "#f3f4f6", borderRadius: "8px", textAlign: "center" }}>
              <p style={{ color: "#4b5563" }}>영상을 재생할 수 없습니다. 유효한 URL을 확인해주세요.</p>
            </div>
            );
          })()}
        </div>
      </div>
    </div>
  );

  // React Portal을 사용하여 body에 직접 렌더링
  return createPortal(modalContent, document.body);
}













