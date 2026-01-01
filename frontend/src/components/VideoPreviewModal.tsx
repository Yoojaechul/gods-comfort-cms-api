import React, { useEffect, useMemo, useRef } from "react";
import { ensureFacebookSdkInitialized, parseXFBML } from "../utils/facebookSdk";

type VideoPlatform = "youtube" | "facebook" | "unknown";

export type VideoPreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;

  // 영상 정보 (프로젝트에서 내려주는 형태를 최대한 허용)
  url?: string; // 유튜브/페이스북 원본 URL
  youtubeId?: string; // 유튜브 ID가 따로 있을 수도 있음
  platform?: string; // "youtube" | "facebook" | etc...
  title?: string;
};

function isFacebookUrl(u?: string) {
  if (!u) return false;
  return /facebook\.com|fb\.watch/i.test(u);
}

function extractYouTubeId(input?: string): string | null {
  if (!input) return null;

  // 이미 ID만 들어온 경우(대부분 11자)
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  // URL 형태 처리
  try {
    const u = new URL(input);

    // youtu.be/ID
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/watch?v=ID
    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtube.com/embed/ID
    const m1 = u.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (m1?.[1]) return m1[1];

    // youtube.com/shorts/ID
    const m2 = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (m2?.[1]) return m2[1];

    return null;
  } catch {
    // URL이 아니면 정규식으로 한 번 더 시도
    const m = input.match(/([a-zA-Z0-9_-]{11})/);
    return m?.[1] ?? null;
  }
}

function buildYouTubeEmbedUrl(input?: string) {
  const videoId = extractYouTubeId(input);
  if (!videoId) return null;

  // ✅ 여기 중요: "..." 같은 문자가 들어가면 안 됩니다.
  // autoplay=1, mute=1, playsinline=1, rel=0 정도만 깔끔하게
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
  });

  // 일부 환경에서 안정성 위해 origin을 붙입니다.
  // (window가 없는 환경 대비)
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function buildFacebookEmbedUrl(originalUrl?: string) {
  if (!originalUrl) return null;

  // Facebook embed는 plugins/video.php 형태가 가장 무난합니다.
  // (기존 정책이 더 있으면 거기에 맞춰 조정)
  const params = new URLSearchParams({
    href: originalUrl,
    show_text: "0",
    width: "960",
  });

  return `https://www.facebook.com/plugins/video.php?${params.toString()}`;
}

export default function VideoPreviewModal(props: VideoPreviewModalProps) {
  const { isOpen, onClose, url, youtubeId, platform, title } = props;
  const facebookContainerRef = useRef<HTMLDivElement>(null);

  const guessedPlatform: VideoPlatform = useMemo(() => {
    const p = (platform || "").toLowerCase();
    if (p.includes("youtube")) return "youtube";
    if (p.includes("facebook")) return "facebook";
    if (isFacebookUrl(url)) return "facebook";
    if (extractYouTubeId(youtubeId || url || "")) return "youtube";
    return "unknown";
  }, [platform, url, youtubeId]);

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Facebook 플랫폼일 때 SDK 초기화 및 XFBML 파싱
  useEffect(() => {
    if (!isOpen) return;
    if (guessedPlatform !== "facebook") return;

    let mounted = true;

    (async () => {
      try {
        // SDK 초기화 확인 및 필요시 로드
        const initSuccess = await ensureFacebookSdkInitialized();
        
        if (!mounted) return;

        if (initSuccess) {
          // XFBML 파싱 (컨테이너가 있으면 해당 컨테이너만, 없으면 전체 문서)
          if (facebookContainerRef.current) {
            parseXFBML(facebookContainerRef.current);
          } else {
            // 약간의 지연 후 파싱 (DOM이 완전히 렌더링된 후)
            setTimeout(() => {
              if (mounted && facebookContainerRef.current) {
                parseXFBML(facebookContainerRef.current);
              }
            }, 100);
          }
        } else {
          console.warn(
            "[VideoPreviewModal] Facebook SDK 초기화 실패 (AppId 없음). " +
            "iframe fallback으로 표시되지만 일부 기능이 제한될 수 있습니다."
          );
        }
      } catch (error) {
        console.error("[VideoPreviewModal] Facebook SDK 초기화/파싱 실패:", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen, guessedPlatform, url]);

  const youtubeEmbed = useMemo(() => buildYouTubeEmbedUrl(youtubeId || url), [youtubeId, url]);
  const facebookEmbed = useMemo(() => buildFacebookEmbedUrl(url), [url]);

  if (!isOpen) return null;

  const renderContent = () => {
    if (guessedPlatform === "youtube") {
      if (!youtubeEmbed) {
        return <div style={{ padding: 16 }}>유튜브 ID를 확인할 수 없습니다. URL/ID를 확인해주세요.</div>;
      }

      return (
        <div style={{ width: "100%", height: "100%" }}>
          <iframe
            // 모달 열 때마다 재로딩되도록 key 부여
            key={youtubeEmbed}
            src={youtubeEmbed}
            title={title || "YouTube Preview"}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              borderRadius: 8,
              background: "#000",
            }}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="origin-when-cross-origin"
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <a
              href={extractYouTubeId(youtubeId || url || "") ? `https://www.youtube.com/watch?v=${extractYouTubeId(youtubeId || url || "")}` : (url || "#")}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                textDecoration: "none",
                color: "#222",
                background: "#fff",
              }}
            >
              유튜브에서 열기
            </a>
          </div>
        </div>
      );
    }

    if (guessedPlatform === "facebook") {
      if (!facebookEmbed) {
        return <div style={{ padding: 16 }}>페이스북 URL이 비어 있습니다.</div>;
      }

      return (
        <div ref={facebookContainerRef} style={{ width: "100%", height: "100%" }}>
          <iframe
            key={facebookEmbed}
            src={facebookEmbed}
            title={title || "Facebook Preview"}
            style={{
              width: "100%",
              height: "100%",
              border: 0,
              borderRadius: 8,
              background: "#000",
            }}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="origin-when-cross-origin"
          />
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <a
              href={url || "#"}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                textDecoration: "none",
                color: "#222",
                background: "#fff",
              }}
            >
              페이스북에서 열기
            </a>
          </div>
        </div>
      );
    }

    return <div style={{ padding: 16 }}>지원하지 않는 영상 타입입니다. URL/플랫폼 값을 확인해주세요.</div>;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(1100px, 96vw)",
          height: "min(720px, 82vh)",
          background: "#fff",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{title || "미리보기"}</div>
          <button
            onClick={onClose}
            style={{
              border: "1px solid #ddd",
              background: "#fff",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>{renderContent()}</div>
      </div>
    </div>
  );
}
