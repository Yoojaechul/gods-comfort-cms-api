import { useState, useEffect } from "react";
import type { Video, VideoPayload } from "../../types/video";
import { CMS_API_BASE } from "../../config";
import { useAuth } from "../../contexts/AuthContext";
import { uploadThumbnail } from "../../lib/cmsClient";
import { getVideoApiEndpoint } from "../../lib/videoApi";
import { buildVideoPayload } from "../../utils/videoPayload";
import { normalizeThumbnailUrl, fetchYouTubeMetadata, extractYoutubeId } from "../../utils/videoMetadata";
import { LANGUAGE_OPTIONS } from "../../constants/languages";
import "./VideoFormModal.css";

interface VideoFormModalProps {
  mode: "create" | "edit";
  initialVideo: Video | null;
  onSubmit: (updatedVideo?: Video) => Promise<void>;
  onClose: () => void;
  onSaved?: (video: Video) => void; // 저장 성공 시 상위에 알려주는 콜백
}

export default function VideoFormModal({
  mode,
  initialVideo,
  onSubmit,
  onClose,
  onSaved,
}: VideoFormModalProps) {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false); // 사용자가 제목을 직접 수정했는지 추적

  const [formData, setFormData] = useState<VideoPayload>({
    title: "",
    description: "",
    creatorName: "",
    sourceType: "youtube",
    sourceUrl: "",
    thumbnailUrl: "",
    language: "en", // 기본값은 영어
    views_actual: 0,
    views_display: 0,
    likes_actual: 0,
    likes_display: 0,
    shares_actual: 0,
    shares_display: 0,
  });

  // YouTube URL 검증 함수
  const validateYouTubeUrl = (url: string): boolean => {
    if (!url || !url.trim()) return false;
    
    // YouTube URL 패턴들
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+$/,
      /^[a-zA-Z0-9_-]{11}$/, // YouTube ID만 입력한 경우
    ];
    
    return patterns.some(pattern => pattern.test(url.trim()));
  };

  // YouTube URL에서 videoId 추출 함수
  const extractYoutubeId = (url: string): string | null => {
    if (!url || !url.trim()) return null;
    
    const trimmed = url.trim();
    
    // YouTube ID만 입력한 경우 (11자리)
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed;
    }
    
    // YouTube URL 패턴들 (www. 포함 및 다양한 형식 지원)
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
      /(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      /(?:www\.)?youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  };

  // Facebook URL 정규화 함수 (불필요한 locale/lang 파라미터 제거)
  const normalizeFacebookUrl = (url: string): string => {
    if (!url || !url.trim()) return url;
    
    const trimmed = url.trim();
    
    // 이미 http:// 또는 https://로 시작하면 그대로 사용
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      try {
        const urlObj = new URL(trimmed);
        // 불필요한 쿼리 파라미터 제거 (locale, lang 등)
        urlObj.searchParams.delete("locale");
        urlObj.searchParams.delete("lang");
        urlObj.searchParams.delete("ref");
        return urlObj.toString();
      } catch {
        return trimmed;
      }
    }
    
    // facebook.com 또는 fb.watch로 시작하면 https:// 추가
    if (trimmed.startsWith("facebook.com/") || trimmed.startsWith("www.facebook.com/") || trimmed.startsWith("fb.watch/")) {
      return `https://${trimmed}`;
    }
    
    // 그 외의 경우 https://를 앞에 붙임
    return `https://${trimmed}`;
  };

  // 초기 데이터 로드 및 Creator name 자동 채우기
  useEffect(() => {
    if (initialVideo && mode === "edit") {
      // 초기값을 API에서 받은 값으로 세팅 (Number()로 명시적 변환)
      setFormData({
        title: initialVideo.title || "",
        description: initialVideo.description || "", // optional 필드 안전 처리
        creatorName: initialVideo.creatorName || "",
        sourceType: (initialVideo as any).sourceType || 
          ((initialVideo as any).video_type === "facebook" ? "facebook" : "youtube"),
        sourceUrl: (initialVideo as any).sourceUrl || (initialVideo as any).source_url || (initialVideo as any).youtube_id || "",
        thumbnailUrl: initialVideo.thumbnailUrl || (initialVideo as any).thumbnail_url || "",
        language: initialVideo.language || (initialVideo as any).lang || "ko", // 언어 코드
        views_actual: Number(initialVideo.viewCountReal) || 0,
        views_display: Number(initialVideo.viewDisplay) || 0,
        likes_actual: Number(initialVideo.likeCountReal) || 0,
        likes_display: Number(initialVideo.likeDisplay) || 0,
        shares_actual: Number(initialVideo.shareCountReal) || 0,
        shares_display: Number(initialVideo.shareDisplay) || 0,
      });
      // 편집 모드에서는 제목이 이미 있으므로 titleTouched를 true로 설정
      setTitleTouched(true);
    } else {
      // Create mode: reset form and auto-fill creator name
      setFormData({
        title: "",
        description: "", // 빈 문자열로 초기화 (optional 필드)
        creatorName: user?.name || "",
        sourceType: "youtube",
        sourceUrl: "",
        thumbnailUrl: "",
        language: "en", // 기본값은 영어
        views_actual: 0,
        views_display: 0,
        likes_actual: 0,
        likes_display: 0,
        shares_actual: 0,
        shares_display: 0,
      });
      // 생성 모드에서는 제목이 비어있으므로 titleTouched를 false로 설정
      setTitleTouched(false);
    }
  }, [initialVideo, mode, user]);

  // YouTube URL 변경 시 제목 자동 가져오기 (디바운싱 적용)
  useEffect(() => {
    // YouTube가 아니거나 sourceUrl이 없으면 실행하지 않음
    if (formData.sourceType !== "youtube" || !formData.sourceUrl || !formData.sourceUrl.trim()) {
      return;
    }

    // 유효한 YouTube URL인지 확인
    if (!validateYouTubeUrl(formData.sourceUrl)) {
      return;
    }

    // 사용자가 제목을 직접 수정한 경우에는 덮어쓰지 않음
    if (titleTouched) {
      return;
    }

    // 디바운싱: 500ms 후 실행
    const timeoutId = setTimeout(() => {
      fetchYouTubeTitleFromOEmbed(formData.sourceUrl);
    }, 500);

    // cleanup: 컴포넌트 언마운트 또는 값 변경 시 이전 timeout 취소
    return () => clearTimeout(timeoutId);
  }, [formData.sourceUrl, formData.sourceType, titleTouched]);

  // YouTube oEmbed API로 제목 가져오기
  const fetchYouTubeTitleFromOEmbed = async (sourceUrl: string) => {
    // YouTube가 아닐 때는 실행하지 않음
    if (formData.sourceType !== "youtube") {
      return;
    }

    if (!sourceUrl || !sourceUrl.trim()) {
      return;
    }

    // 유효한 YouTube URL일 때만 실행
    if (!validateYouTubeUrl(sourceUrl)) {
      return;
    }

    // 사용자가 제목을 직접 수정한 경우에는 덮어쓰지 않음
    if (titleTouched) {
      console.log("[VideoFormModal] 제목이 사용자에 의해 수정되었으므로 자동 채우기 건너뜀");
      return;
    }

    setMetadataLoading(true);
    setMetadataError(null);

    try {
      // fetchYouTubeMetadata 함수 사용 (oEmbed API 직접 호출)
      const metadata = await fetchYouTubeMetadata(sourceUrl);
      
      // 제목이 있으면 자동으로 채우기 (titleTouched가 false일 때만)
      if (metadata.title && !titleTouched) {
        setFormData((prev) => ({ ...prev, title: metadata.title || "" }));
        console.log("[VideoFormModal] YouTube 제목 자동 채우기:", metadata.title);
      }
      
      // 썸네일 URL이 없고 메타데이터에 썸네일이 있으면 자동으로 채우기
      if (metadata.thumbnail_url && !formData.thumbnailUrl) {
        setFormData((prev) => ({ ...prev, thumbnailUrl: metadata.thumbnail_url || "" }));
      }
    } catch (err) {
      // 네트워크 오류 등 예외 발생 시에도 경고만 표시하고 계속 진행
      console.warn("[VideoFormModal] YouTube 제목 가져오기 중 오류 발생 (계속 진행):", err);
      setMetadataError(null); // 에러 메시지 숨김
    } finally {
      setMetadataLoading(false);
    }
  };

  // Source URL 메타데이터 가져오기 (YouTube만 지원)
  // 백엔드 API가 없을 수 있으므로 실패해도 저장은 가능하도록 처리
  const fetchMetadata = async () => {
    // YouTube가 아닐 때는 절대 실행하지 않음
    if (formData.sourceType !== "youtube") {
      console.log("[VideoFormModal] fetchMetadata 호출 차단: sourceType이 youtube가 아님", formData.sourceType);
      return;
    }

    if (!formData.sourceUrl) {
      console.log("[VideoFormModal] fetchMetadata 호출 차단: sourceUrl이 없음");
      return;
    }

    // 유효한 YouTube URL일 때만 실행 (youtube.com 또는 youtu.be)
    if (!validateYouTubeUrl(formData.sourceUrl)) {
      console.log("[VideoFormModal] fetchMetadata 호출 차단: 유효하지 않은 YouTube URL", formData.sourceUrl);
      return;
    }

    console.log("[VideoFormModal] fetchMetadata 호출: YouTube URL 검증 통과", formData.sourceUrl);

    setMetadataLoading(true);
    setMetadataError(null);

    try {
      // URL 정규화: http:// 또는 https://로 시작하지 않으면 https://를 앞에 붙임
      let normalizedUrl = formData.sourceUrl.trim();
      if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      const response = await fetch(`${CMS_API_BASE}/videos/metadata`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          source_type: "youtube",
          source_url: normalizedUrl,
        }),
      });

      if (!response.ok) {
        // 404 등 API가 없는 경우 oEmbed API로 폴백
        if (response.status === 404) {
          console.warn("[VideoFormModal] 메타데이터 API가 없습니다. oEmbed API로 폴백합니다.");
          // oEmbed API로 제목 가져오기
          await fetchYouTubeTitleFromOEmbed(formData.sourceUrl);
          return;
        }
        
        const errorText = await response.text();
        let errorMessage = "메타데이터를 가져오는데 실패했습니다.";
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        // 404가 아닌 다른 에러는 oEmbed API로 폴백
        console.warn("[VideoFormModal] 메타데이터 가져오기 실패, oEmbed API로 폴백:", errorMessage);
        await fetchYouTubeTitleFromOEmbed(formData.sourceUrl);
        return;
      }

      const data = await response.json();
      
      // 메타데이터로 자동 채우기 (titleTouched가 false일 때만 제목 업데이트)
      if (data.title && !titleTouched) {
        setFormData((prev) => ({ ...prev, title: data.title }));
      }
      if (data.description) {
        setFormData((prev) => ({ ...prev, description: data.description }));
      }
      if (data.thumbnail_url) {
        setFormData((prev) => ({ ...prev, thumbnailUrl: data.thumbnail_url }));
      }
    } catch (err) {
      // 네트워크 오류 등 예외 발생 시에도 oEmbed API로 폴백
      console.warn("[VideoFormModal] 메타데이터 가져오기 중 오류 발생, oEmbed API로 폴백:", err);
      await fetchYouTubeTitleFromOEmbed(formData.sourceUrl);
    } finally {
      setMetadataLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:208',message:'handleSubmit entry - CODE UPDATED',data:{mode,sourceType:formData.sourceType,thumbnailUrl:formData.thumbnailUrl,codeVersion:'v6'},timestamp:Date.now(),sessionId:'debug-session',runId:'run6',hypothesisId:'F'})}).catch(()=>{});
    // #endregion

    // 썸네일 URL 안전하게 계산 (handleSubmit 시작 부분에서 항상 선언 - try 블록 밖에서)
    // 우선순위: 1) 사용자 입력값(thumbnailUrlInput), 2) 업로드된 파일 URL(uploadedThumbnailUrl), 3) null
    const thumbnailUrlInput = formData.thumbnailUrl?.trim() || "";
    const uploadedThumbnailUrl = formData.thumbnailUrl?.trim() || ""; // 현재 구조에서는 formData.thumbnailUrl에 저장됨
    
    const finalThumbnailUrl: string | null =
      (thumbnailUrlInput && thumbnailUrlInput.trim() !== "")
        ? thumbnailUrlInput
        : uploadedThumbnailUrl
          ? uploadedThumbnailUrl
          : null;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:230',message:'finalThumbnailUrl calculated - CODE UPDATED v8',data:{thumbnailUrlInput,uploadedThumbnailUrl,finalThumbnailUrl,codeVersion:'v8',declaredOutsideTry:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run8',hypothesisId:'H'})}).catch(()=>{});
    // #endregion

    try {
      // YouTube일 때만 URL 검증
      if (formData.sourceType === "youtube" && formData.sourceUrl) {
        if (!validateYouTubeUrl(formData.sourceUrl)) {
          setError("올바른 YouTube URL 또는 ID를 입력해주세요.");
          setLoading(false);
          return;
        }
      }

      // role에 따라 API 엔드포인트 결정
      // user?.role이 없으면 에러를 발생시키는 것이 안전하지만, 
      // 일단 기본값을 사용하되 실제로는 AuthContext에서 항상 role이 제공되어야 함
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      }
      const userRole = user.role as "admin" | "creator";
      const apiPath = getVideoApiEndpoint(
        userRole,
        mode === "edit" ? String(initialVideo?.id || "") : undefined
      );
      const url = `${CMS_API_BASE}${apiPath}`;
      const method = mode === "create" ? "POST" : "PUT";
      
      // payload 생성 - 공통 헬퍼 함수 사용 (대량 등록과 동일한 구조)
      const basePayload = buildVideoPayload({
        sourceUrl: formData.sourceUrl || "", // 빈 문자열이라도 전달 (백엔드에서 검증)
        sourceType: formData.sourceType,
        title: formData.title,
        thumbnailUrl: finalThumbnailUrl || undefined, // null이면 undefined로 전달 (buildVideoPayload가 빈 값 제외)
        description: formData.description,
        language: formData.language || "en",
        creatorName: formData.creatorName || user?.name,
      });
      
      // 편집 모드일 때만 메트릭스 필드 추가 (any 타입으로 확장)
      const payload: any = { ...basePayload };
      
      // 썸네일 URL을 payload에 안전하게 추가 (백엔드가 기대하는 키: thumbnailUrl 또는 thumbnail_url)
      // finalThumbnailUrl을 그대로 넣기 (null 허용, Facebook은 썸네일 필수 아님)
      payload.thumbnailUrl = finalThumbnailUrl;
      payload.thumbnail_url = finalThumbnailUrl; // 백엔드가 기대하는 키

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:277',message:'payload thumbnailUrl set - CODE UPDATED v8',data:{finalThumbnailUrl,payloadThumbnailUrl:payload.thumbnailUrl,payloadThumbnail_url:payload.thumbnail_url,codeVersion:'v8'},timestamp:Date.now(),sessionId:'debug-session',runId:'run8',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      // 공통: source_url을 항상 세팅 (서버가 요구하는 필드)
      if (formData.sourceUrl) {
        payload.source_url = formData.sourceUrl.trim();
      }

      // YouTube videoType일 때 youtubeId 추출 및 추가 (서버 검증 요구사항)
      // buildVideoPayload에서 추가되지 않은 경우를 대비해 여기서도 확인
      if (payload.videoType === "youtube" && formData.sourceUrl && !payload.youtubeId) {
        const youtubeId = extractYoutubeId(formData.sourceUrl);
        if (youtubeId) {
          payload.youtubeId = youtubeId;
        }
      }

      // Facebook videoType일 때 facebookUrl 정규화 및 추가 (호환용)
      if (payload.videoType === "facebook" && formData.sourceUrl) {
        const normalizedFacebookUrl = normalizeFacebookUrl(formData.sourceUrl);
        payload.facebookUrl = normalizedFacebookUrl;
        payload.source_url = normalizedFacebookUrl; // source_url도 정규화된 URL로 업데이트
      }

      // 디버깅을 위해 콘솔에 전체 payload 출력 (create/edit 모두)
      // #region agent log
      // finalThumbnailUrl을 안전하게 참조하기 위해 로컬 변수에 저장
      const finalThumbnailUrlForLog = finalThumbnailUrl;
      try {
        console.log(`[VideoFormModal] ${mode === "create" ? "생성" : "편집"} payload (전체):`, JSON.stringify(payload, null, 2));
        console.log(`[VideoFormModal] ${mode === "create" ? "생성" : "편집"} payload (요약):`, {
          title: payload.title,
          videoType: payload.videoType, // 백엔드에서 요구하는 필드
          sourceType: payload.sourceType,
          sourceUrl: payload.sourceUrl,
          source_url: payload.source_url, // 공통 필드 (항상 포함)
          facebookUrl: payload.facebookUrl, // Facebook일 때 추가되는 필드
          youtubeId: payload.youtubeId, // YouTube일 때 추가되는 필드
          language: payload.language,
          thumbnailUrl: payload.thumbnailUrl,
          thumbnail_url: payload.thumbnail_url, // 백엔드가 기대하는 키
          finalThumbnailUrl: finalThumbnailUrlForLog, // 계산된 최종 썸네일 URL (로컬 변수 사용)
        });
        fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:299',message:'console.log success',data:{finalThumbnailUrlAccessible:true,finalThumbnailUrl:finalThumbnailUrlForLog},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
      } catch (consoleErr) {
        fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:299',message:'console.log error',data:{error:String(consoleErr),finalThumbnailUrlAccessible:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run5',hypothesisId:'E'})}).catch(()=>{});
      }
      // #endregion

      // 편집 모드일 때만 실제 값과 노출 값 포함 (Number()로 명시적 변환)
      // 백엔드 API 호환성을 위해 camelCase와 snake_case 모두 전송
      if (mode === "edit") {
        const viewCount = Number(formData.views_actual) || 0;
        const likeCount = Number(formData.likes_actual) || 0;
        const shareCount = Number(formData.shares_actual) || 0;
        const viewDisplay = Number(formData.views_display) || 0;
        const likeDisplay = Number(formData.likes_display) || 0;
        const shareDisplay = Number(formData.shares_display) || 0;

        // 실제 값 (camelCase)
        payload.viewCount = viewCount;
        payload.likeCount = likeCount;
        payload.shareCount = shareCount;
        
        // 실제 값 (snake_case) - 백엔드 호환성
        payload.view_count = viewCount;
        payload.like_count = likeCount;
        payload.share_count = shareCount;
        
        // 노출 값 (camelCase)
        payload.viewDisplay = viewDisplay;
        payload.likeDisplay = likeDisplay;
        payload.shareDisplay = shareDisplay;
        
        // 노출 값 (snake_case) - 백엔드 호환성
        payload.view_display = viewDisplay;
        payload.like_display = likeDisplay;
        payload.share_display = shareDisplay;
        
        // 편집 모드 디버깅 로그
        console.log("[VideoFormModal] 편집 payload (메트릭스 포함):", {
          viewCount,
          likeCount,
          shareCount,
          viewDisplay,
          likeDisplay,
          shareDisplay,
        });
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:348',message:'before fetch request - CODE UPDATED v8',data:{url,method,videoType:payload.videoType,finalThumbnailUrl,payloadThumbnailUrl:payload.thumbnailUrl,codeVersion:'v8'},timestamp:Date.now(),sessionId:'debug-session',runId:'run8',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:361',message:'after fetch response - CODE UPDATED v8',data:{ok:response.ok,status:response.status,codeVersion:'v8'},timestamp:Date.now(),sessionId:'debug-session',runId:'run8',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "저장에 실패했습니다.";
        try {
          const errorData = JSON.parse(errorText);
          // 서버 응답 body.message를 우선 표시
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          // JSON 파싱 실패 시 기본 메시지 사용
        }
        throw new Error(errorMessage);
      }

      // 성공 시 백엔드 응답에서 업데이트된 video 객체 가져오기
      const responseData = await response.json();
      const rawVideo = responseData.video || responseData.data || responseData;
      
      // 백엔드 응답 필드명을 프론트엔드 필드명으로 매핑
      // 백엔드에서 보낼 수 있는 다양한 필드명을 처리
      const updatedVideo: Video = {
        ...rawVideo,
        // 관리번호 및 언어 매핑
        managementId: rawVideo.managementId ?? rawVideo.management_id ?? rawVideo.video_code ?? null,
        language: rawVideo.language ?? rawVideo.lang ?? "ko",
        // metrics 필드 매핑 (다양한 백엔드 필드명 지원)
        viewCountReal: rawVideo.viewCountReal ?? rawVideo.view_count_real ?? rawVideo.viewReal ?? rawVideo.views_actual ?? 0,
        viewDisplay: rawVideo.viewDisplay ?? rawVideo.view_display ?? rawVideo.views_display ?? 0,
        likeCountReal: rawVideo.likeCountReal ?? rawVideo.like_count_real ?? rawVideo.likeReal ?? rawVideo.likes_actual ?? 0,
        likeDisplay: rawVideo.likeDisplay ?? rawVideo.like_display ?? rawVideo.likes_display ?? 0,
        shareCountReal: rawVideo.shareCountReal ?? rawVideo.share_count_real ?? rawVideo.shareReal ?? rawVideo.shares_actual ?? 0,
        shareDisplay: rawVideo.shareDisplay ?? rawVideo.share_display ?? rawVideo.shares_display ?? 0,
      };
      
      // 디버깅을 위해 콘솔에 응답 로그 출력
      console.log("저장 response:", {
        id: updatedVideo.id,
        title: updatedVideo.title,
        language: updatedVideo.language,
        managementId: updatedVideo.managementId || (updatedVideo as any).video_code,
        viewCountReal: updatedVideo.viewCountReal,
        viewDisplay: updatedVideo.viewDisplay,
        likeCountReal: updatedVideo.likeCountReal,
        likeDisplay: updatedVideo.likeDisplay,
        shareCountReal: updatedVideo.shareCountReal,
        shareDisplay: updatedVideo.shareDisplay,
      });

      // 성공 시 토스트 메시지 표시
      setSuccessMessage("저장되었습니다.");
      setError(null); // 에러 메시지 초기화
      
      // onSaved 콜백 호출 (즉시 리스트 업데이트를 위해)
      if (onSaved && updatedVideo) {
        onSaved(updatedVideo);
      }
      
      // 목록 새로고침 (업데이트된 video 객체 전달)
      await onSubmit(updatedVideo);
      
      // 약간의 지연 후 모달 닫기 (토스트 메시지를 볼 수 있도록)
      setTimeout(() => {
        setSuccessMessage(null); // 성공 메시지 초기화
        onClose();
      }, 500);
    } catch (err) {
      // #region agent log
      // finalThumbnailUrl은 try 블록 밖에서 선언되었으므로 catch 블록에서 접근 가능해야 함
      // 하지만 안전을 위해 try-catch로 감싸서 로깅
      let finalThumbnailUrlForLog: string | null | string = 'UNKNOWN';
      let finalThumbnailUrlExists = false;
      try {
        // finalThumbnailUrl 접근 가능 여부 확인
        void finalThumbnailUrl; // 접근 가능 여부만 확인
        finalThumbnailUrlExists = true;
        finalThumbnailUrlForLog = finalThumbnailUrl;
      } catch (e) {
        finalThumbnailUrlExists = false;
        finalThumbnailUrlForLog = 'ERROR_ACCESSING: ' + String(e);
      }
      const errorDetails = {
        error: err instanceof Error ? err.message : String(err),
        errorType: err instanceof Error ? 'Error' : typeof err,
        errorStack: err instanceof Error ? err.stack : 'no stack',
        finalThumbnailUrl: finalThumbnailUrlForLog,
        finalThumbnailUrlExists,
        finalThumbnailUrlType: typeof finalThumbnailUrl,
      };
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'VideoFormModal.tsx:451',message:'handleSubmit error - CODE UPDATED v8',data:{...errorDetails,codeVersion:'v8',finalThumbnailUrlDeclaredAt:222,finalThumbnailUrlInScope:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run8',hypothesisId:'H'})}).catch(()=>{});
      // #endregion

      console.error("Failed to save video:", err);
      // 서버 응답의 message를 우선 표시, 없으면 Error 객체의 message 사용
      let errorMessage = "저장 중 오류가 발생했습니다.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      // 에러 발생 시에도 모달은 유지 (사용자가 수정 가능)
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    // sourceType이 변경되면 입력값/에러 상태 초기화
    if (name === "sourceType") {
      setFormData((prev) => ({
        ...prev,
        sourceType: value as "youtube" | "facebook",
        sourceUrl: "", // 소스 URL 초기화
        thumbnailUrl: "", // 썸네일 URL 초기화 (YouTube는 나중에 자동 세팅될 수 있음)
      }));
      setError(null);
      setMetadataError(null);
      setMetadataLoading(false);
      setTitleTouched(false); // sourceType 변경 시 titleTouched 초기화
      return;
    }
    
    // 제목 필드가 변경되면 titleTouched를 true로 설정
    if (name === "title") {
      setTitleTouched(true);
    }
    
    // sourceUrl이 변경되면 titleTouched를 false로 리셋 (새 URL이므로 제목을 자동으로 채울 수 있음)
    if (name === "sourceUrl") {
      setTitleTouched(false);
    }
    
    // 입력값이 문자열로 들어온다면 Number()로 숫자로 변환
    const updatedFormData: any = {
      ...formData,
      [name]: name.includes("_actual") || name.includes("_display") 
        ? Number(value) || 0  // 숫자 필드는 Number()로 명시적 변환
        : value,
    };

    // sourceType이 Facebook으로 바뀌면 metadata 관련 에러/상태 초기화
    if (name === "sourceType" && value === "facebook") {
      setMetadataError(null);
      setMetadataLoading(false);
    }

    setFormData(updatedFormData);
  };

  const handleSourceUrlBlur = () => {
    // YouTube일 때만 메타데이터 가져오기 및 썸네일 자동 세팅
    if (formData.sourceType === "youtube" && formData.sourceUrl) {
      // 추가 검증: URL이 youtube.com 또는 youtu.be를 포함하는지 확인
      const urlLower = formData.sourceUrl.toLowerCase().trim();
      const isYouTubeUrl = urlLower.includes("youtube.com") || urlLower.includes("youtu.be") || /^[a-zA-Z0-9_-]{11}$/.test(urlLower);
      
      if (isYouTubeUrl && validateYouTubeUrl(formData.sourceUrl)) {
        // YouTube videoId 추출
        const youtubeId = extractYoutubeId(formData.sourceUrl);
        
        // 썸네일 URL이 비어있으면 자동으로 기본 썸네일 URL 세팅
        if (youtubeId && !formData.thumbnailUrl) {
          const defaultThumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
          setFormData((prev) => ({ ...prev, thumbnailUrl: defaultThumbnailUrl }));
        }
        
        // 메타데이터 가져오기 (백엔드 API 시도, 실패 시 oEmbed로 폴백)
        fetchMetadata();
        
        // oEmbed API로 제목 가져오기 (백엔드 API와 병렬로 실행)
        fetchYouTubeTitleFromOEmbed(formData.sourceUrl);
      } else {
        console.log("[VideoFormModal] handleSourceUrlBlur: YouTube URL이 아니므로 fetchMetadata 호출 안 함", formData.sourceUrl);
      }
    } else if (formData.sourceType === "facebook" && formData.sourceUrl) {
      // Facebook URL 정규화
      const normalizedUrl = normalizeFacebookUrl(formData.sourceUrl);
      if (normalizedUrl !== formData.sourceUrl) {
        setFormData((prev) => ({ ...prev, sourceUrl: normalizedUrl }));
      }
    } else {
      console.log("[VideoFormModal] handleSourceUrlBlur: sourceType이 youtube가 아니므로 fetchMetadata 호출 안 함", formData.sourceType);
    }
  };

  // 썸네일 파일 업로드 핸들러
  const handleThumbnailFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 타입 검증
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    try {
      setUploadingThumbnail(true);
      setError(null);
      
      console.log("썸네일 파일 업로드 시작:", { fileName: file.name, fileType: file.type, fileSize: file.size });
      
      // role에 따라 썸네일 업로드 엔드포인트 선택
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      }
      const userRole = user.role as "admin" | "creator";
      const uploadResult = await uploadThumbnail(file, userRole);
      
      if (!uploadResult || !uploadResult.url) {
        throw new Error("썸네일 업로드에 실패했습니다. 다시 시도해 주세요.");
      }
      
      const url = uploadResult.url;
      console.log("uploaded thumbnail url:", url);
      
      // formData 상태 업데이트
      setFormData((prev) => {
        const updated = { ...prev, thumbnailUrl: url };
        console.log("formData.thumbnailUrl 업데이트:", updated.thumbnailUrl);
        return updated;
      });
      
      console.log("썸네일 업로드 완료:", url);
    } catch (err) {
      console.error("thumbnail upload error", err);
      setError(err instanceof Error ? err.message : "썸네일 업로드에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  const isAdmin = user?.role === "admin";
  const showMetrics = mode === "edit" && isAdmin;

  return (
    <div className="video-form-modal-overlay" onClick={onClose}>
      <div className="video-form-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="video-form-modal-close" onClick={onClose}>
          ×
        </button>
        <h2 className="video-form-modal-title">
          {mode === "create" ? "영상 추가" : "영상 편집"}
        </h2>

        {successMessage && (
          <div className="video-form-modal-error" style={{ backgroundColor: "#d4edda", color: "#155724", border: "1px solid #c3e6cb" }}>
            <p>{successMessage}</p>
          </div>
        )}

        {error && (
          <div className="video-form-modal-error">
            <p>{error}</p>
          </div>
        )}

        {metadataError && (
          <div className="video-form-modal-error" style={{ backgroundColor: "#fff3cd", color: "#856404" }}>
            <p>메타데이터: {metadataError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="video-form-modal-form">
          {/* 1. Source Type (맨 위로 이동) */}
          <div className="video-form-field">
            <label className="video-form-label">
              소스 타입 <span className="required">*</span>
            </label>
            <select
              name="sourceType"
              value={formData.sourceType}
              onChange={handleChange}
              className="video-form-select"
              required
            >
              <option value="youtube">YouTube</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>

          {/* 2. Source URL (타입별 라벨/placeholder 동적 변경) */}
          <div className="video-form-field">
            <label className="video-form-label">
              {formData.sourceType === "youtube" 
                ? "YouTube URL 또는 Video ID" 
                : "Facebook URL"} <span className="required">*</span>
            </label>
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                name="sourceUrl"
                value={formData.sourceUrl}
                onChange={handleChange}
                onBlur={handleSourceUrlBlur}
                className="video-form-input"
                placeholder={
                  formData.sourceType === "youtube" 
                    ? "https://www.youtube.com/watch?v=... 또는 Video ID" 
                    : "https://www.facebook.com/watch/?v=... 또는 https://fb.watch/..."
                }
                required
                style={{ flex: 1 }}
              />
              {metadataLoading && (
                <button type="button" disabled style={{ padding: "8px 16px", backgroundColor: "#ccc", border: "none", borderRadius: "4px", cursor: "not-allowed" }}>
                  로딩...
                </button>
              )}
            </div>
          </div>

          {/* 3. Title */}
          <div className="video-form-field">
            <label className="video-form-label">
              제목 <span className="required">*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              className="video-form-input"
              required
            />
          </div>

          {/* 4. Thumbnail URL (타입별 처리 분기) */}
          <div className="video-form-field">
            <label className="video-form-label">
              썸네일 {formData.sourceType === "youtube" ? "URL (자동 생성됨)" : "URL 또는 파일"}
            </label>
            {formData.sourceType === "youtube" ? (
              // YouTube: 썸네일 URL 입력 (자동 생성된 기본값 표시)
              <>
                <input
                  type="text"
                  name="thumbnailUrl"
                  value={formData.thumbnailUrl}
                  onChange={handleChange}
                  className="video-form-input"
                  placeholder="YouTube Video ID 입력 시 자동으로 생성됩니다."
                />
                {formData.thumbnailUrl && (
                  <div style={{ marginTop: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                      미리보기:
                    </span>
                    <img
                      src={normalizeThumbnailUrl(formData.thumbnailUrl, CMS_API_BASE) || formData.thumbnailUrl}
                      alt="thumbnail preview"
                      onLoad={() => {
                        console.log("썸네일 미리보기 이미지 로드 성공:", formData.thumbnailUrl);
                      }}
                      onError={(e) => {
                        console.error("썸네일 미리보기 이미지 로드 실패:", formData.thumbnailUrl, e);
                        setError("썸네일 이미지를 불러올 수 없습니다. URL을 확인해주세요.");
                      }}
                      style={{
                        maxWidth: "160px",
                        maxHeight: "90px",
                        borderRadius: "4px",
                        border: "1px solid #e5e7eb",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
              </>
            ) : (
              // Facebook: 썸네일 URL 또는 파일 업로드 둘 중 하나 선택
              <>
                <input
                  type="text"
                  name="thumbnailUrl"
                  value={formData.thumbnailUrl}
                  onChange={handleChange}
                  className="video-form-input"
                  placeholder="썸네일 URL을 입력하거나 아래에서 파일을 업로드하세요."
                />
                <div style={{ marginTop: "8px" }}>
                  <label className="video-form-label" style={{ fontSize: "14px", marginBottom: "4px", display: "block" }}>
                    썸네일 파일 업로드
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailFileChange}
                    disabled={uploadingThumbnail}
                    style={{
                      padding: "4px",
                      fontSize: "14px",
                      border: "1px solid #d1d5db",
                      borderRadius: "4px",
                      width: "100%",
                    }}
                  />
                  {uploadingThumbnail && (
                    <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                      썸네일 업로드 중...
                    </p>
                  )}
                </div>
                {formData.thumbnailUrl && (
                  <div style={{ marginTop: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                      미리보기:
                    </span>
                    <img
                      src={normalizeThumbnailUrl(formData.thumbnailUrl, CMS_API_BASE) || formData.thumbnailUrl}
                      alt="thumbnail preview"
                      onLoad={() => {
                        console.log("썸네일 미리보기 이미지 로드 성공:", formData.thumbnailUrl);
                      }}
                      onError={(e) => {
                        console.error("썸네일 미리보기 이미지 로드 실패:", formData.thumbnailUrl, e);
                        setError("썸네일 이미지를 불러올 수 없습니다. URL을 확인해주세요.");
                      }}
                      style={{
                        maxWidth: "160px",
                        maxHeight: "90px",
                        borderRadius: "4px",
                        border: "1px solid #e5e7eb",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 5. Language - 추가/편집 모드 모두에서 표시 */}
          <div className="video-form-field">
            <label className="video-form-label">언어</label>
            <select
              name="language"
              value={formData.language || "en"}
              onChange={handleChange}
              className="video-form-select"
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상세 정보 섹션 - 편집 모드에서만 표시 */}
          {mode === "edit" && initialVideo && (
            <div className="video-form-metrics-section" style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb" }}>
              <h3 className="video-form-metrics-title">상세 정보</h3>

              <div className="video-form-metrics-grid">
                {/* 영상 관리번호 */}
                <div className="video-form-field">
                  <label className="video-form-label">영상 관리번호</label>
                  <input
                    type="text"
                    value={initialVideo.managementId || (initialVideo as any).video_code || ""}
                    placeholder="저장 시 자동 생성 (YYMMDD-XXX)"
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>


                {/* 플랫폼 */}
                <div className="video-form-field">
                  <label className="video-form-label">플랫폼</label>
                  <input
                    type="text"
                    value={formData.sourceType === "youtube" ? "YouTube" : formData.sourceType === "facebook" ? "Facebook" : "파일 업로드"}
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>

                {/* 등록일 */}
                <div className="video-form-field">
                  <label className="video-form-label">등록일</label>
                  <input
                    type="text"
                    value={initialVideo.createdAt ? new Date(initialVideo.createdAt).toLocaleString("ko-KR") : "-"}
                    className="video-form-input"
                    readOnly
                    style={{ backgroundColor: "#f5f5f5", cursor: "not-allowed" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Metrics Section - Only for admin edit mode */}
          {showMetrics && (
            <div className="video-form-metrics-section">
              <h3 className="video-form-metrics-title">메트릭스</h3>

              <div className="video-form-metrics-grid">
                <div className="video-form-field">
                  <label className="video-form-label">조회수 (실제)</label>
                  <input
                    type="number"
                    name="views_actual"
                    value={formData.views_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">조회수 (노출)</label>
                  <input
                    type="number"
                    name="views_display"
                    value={formData.views_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">좋아요 (실제)</label>
                  <input
                    type="number"
                    name="likes_actual"
                    value={formData.likes_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">좋아요 (노출)</label>
                  <input
                    type="number"
                    name="likes_display"
                    value={formData.likes_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">공유 (실제)</label>
                  <input
                    type="number"
                    name="shares_actual"
                    value={formData.shares_actual}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>

                <div className="video-form-field">
                  <label className="video-form-label">공유 (노출)</label>
                  <input
                    type="number"
                    name="shares_display"
                    value={formData.shares_display}
                    onChange={handleChange}
                    className="video-form-input"
                    min="0"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="video-form-modal-actions">
            <button type="button" onClick={onClose} className="video-form-button-cancel">
              취소
            </button>
            <button type="submit" disabled={loading} className="video-form-button-submit">
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
