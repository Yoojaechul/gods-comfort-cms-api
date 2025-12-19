import { useEffect, useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { apiGet, apiDelete } from "../lib/apiClient";
import type { Video } from "../types/video";
import VideoFormModal from "../components/admin/VideoFormModal";
import BulkVideosModal from "../components/admin/BulkVideosModal";
import VideoPreviewModal from "../components/VideoPreviewModal";
import VideoCard from "../components/VideoCard";
import { getVideoDeleteApiEndpoint, getVideosListApiEndpoint } from "../lib/videoApi";
import { sortVideosByManagementNumber } from "../utils/videoSort";
import { normalizeThumbnailUrl } from "../utils/videoMetadata";
import "../styles/admin-videos.css";
import "../styles/admin-common.css";

interface VideosPageProps {
  role?: "admin" | "creator";
}

export default function AdminVideosPage({ role = "admin" }: VideosPageProps) {
  const { token, user } = useAuth();
  
  // role prop이 없으면 user의 role 사용
  const currentRole = role || user?.role || "admin";
  const isAdmin = currentRole === "admin";
  
  // 원본 영상 목록 (API에서 가져온 전체 목록)
  const [videos, setVideos] = useState<Video[]>([]);
  // 필터링된 영상 목록 (실제로 화면에 표시되는 목록)
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  
  // 필터 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  // 탭 제거: 기본적으로 active 상태만 사용
  const activeTab: "active" = "active";
  
  // UI 상태
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVideo, setModalVideo] = useState<Video | null>(null);
  
  // 모달 상태
  const [showVideoFormModal, setShowVideoFormModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  
  // 일괄 선택 상태
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 초기 로드 시 전체 영상 조회 (필터 없이, 삭제되지 않은 영상만)
  useEffect(() => {
    // 컴포넌트 마운트 시 자동으로 전체 영상 목록 불러오기
    if (token) {
      fetchVideos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // 초기 로드 후 전체 영상 표시 (서버에서 이미 필터링된 데이터를 받으므로 그대로 사용)
  useEffect(() => {
    if (!isLoading && Array.isArray(videos)) {
      // 관리번호 기준 내림차순 정렬 (최신 영상이 먼저 오도록)
      const sortedVideos = sortVideosByManagementNumber(videos);
      setFilteredVideos(sortedVideos);
      // 데이터가 변경되면 현재 페이지가 유효한 범위인지 확인
      const totalPages = Math.max(1, Math.ceil(sortedVideos.length / pageSize));
      setCurrentPage(prev => {
        if (prev > totalPages && totalPages > 0) {
          return 1;
        }
        return prev;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, videos]);


  const fetchVideos = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 쿼리 파라미터 구성: 값이 있을 때만 포함
      const params: Record<string, string> = {};
      
      // 검색어는 q 파라미터로 전달 (제목, 설명, 영상 관리번호, 크리에이터, 등록 날짜 검색)
      if (searchTerm && searchTerm.trim() !== "") {
        params.q = searchTerm.trim();
      }
      
      if (startDate && startDate !== "") {
        params.startDate = startDate;
      }
      
      if (endDate && endDate !== "") {
        params.endDate = endDate;
      }
      
      // 쿼리 스트링 생성
      const queryString = Object.keys(params).length > 0
        ? "?" + new URLSearchParams(params).toString()
        : "";
      
      // role에 따라 API 엔드포인트 결정
      const userRole = (currentRole || user?.role || "admin") as "admin" | "creator";
      const apiPath = getVideosListApiEndpoint(userRole);
      const endpoint = `${apiPath}${queryString}`;
      
      // apiClient를 사용하여 일관된 에러 핸들링
      const data = await apiGet<any>(endpoint, { auth: true });
      
      // 콘솔에 응답 로그 출력
      console.log('GET /videos 응답:', data);
      
      // API 응답을 항상 배열로 정규화
      // 우선순위: 배열 > items > videos > data
      const items: Video[] = Array.isArray(data) 
        ? data 
        : (data?.items || data?.videos || data?.data || []);
      
      // 최종적으로 배열이 아니면 빈 배열 사용
      if (!Array.isArray(items)) {
        console.warn("API 응답이 예상과 다른 형식입니다:", data);
        setVideos([]);
        setFilteredVideos([]);
        setIsLoading(false);
        return;
      }
      
      console.log(`파싱된 영상 개수: ${items.length}개`);
      
      // 첫 번째 영상 객체의 모든 필드 로그 출력 (출처/관리번호 필드명 확인용)
      if (items.length > 0) {
        const firstVideo = items[0];
        console.log('[영상 리스트] 첫 번째 영상 객체 전체 필드:', firstVideo);
        console.log('[영상 리스트] 출처 관련 필드:', {
          sourceType: (firstVideo as any).sourceType,
          source_type: (firstVideo as any).source_type,
          source: (firstVideo as any).source,
          video_type: (firstVideo as any).video_type,
          videoType: (firstVideo as any).videoType,
          platform: (firstVideo as any).platform,
        });
        console.log('[영상 리스트] 관리번호 관련 필드:', {
          videoManageNo: (firstVideo as any).videoManageNo,
          video_manage_no: (firstVideo as any).video_manage_no,
          manageNo: (firstVideo as any).manageNo,
          managementNo: (firstVideo as any).managementNo,
          managementId: (firstVideo as any).managementId,
          management_no: (firstVideo as any).management_no,
          managementNumber: (firstVideo as any).managementNumber,
          management_id: (firstVideo as any).management_id,
          adminCode: (firstVideo as any).adminCode,
          code: (firstVideo as any).code,
          video_code: (firstVideo as any).video_code,
          adminId: (firstVideo as any).adminId,
          admin_id: (firstVideo as any).admin_id,
          // 추가 필드명 확인
          management_code: (firstVideo as any).management_code,
          video_management_no: (firstVideo as any).video_management_no,
          videoManagementNo: (firstVideo as any).videoManagementNo,
        });
        console.log('[영상 리스트] 썸네일 관련 필드:', {
          thumbnailUrl: (firstVideo as any).thumbnailUrl,
          thumbnail_url: (firstVideo as any).thumbnail_url,
          thumbnail: (firstVideo as any).thumbnail,
          thumbnailPath: (firstVideo as any).thumbnailPath,
          thumbnail_path: (firstVideo as any).thumbnail_path,
          thumbnailFileUrl: (firstVideo as any).thumbnailFileUrl,
          thumbnail_file_url: (firstVideo as any).thumbnail_file_url,
          thumbnailImage: (firstVideo as any).thumbnailImage,
          thumbnail_image: (firstVideo as any).thumbnail_image,
        });
      }
      
      // #region agent log - API 응답 후 정렬 전
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminVideosPage.tsx:fetchVideos',message:'API 응답 후 정렬 전',data:{itemCount:items.length,firstFew:items.slice(0,3).map(v=>({id:v.id,title:v.title?.substring(0,20),manageNo:(v as any).manageNo,managementId:v.managementId}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      
      // 성공 시에만 상태 업데이트
      // 빈 배열이어도 정상 응답이므로 상태 업데이트 (화면에 "검색 결과가 없습니다." 표시)
      
      // 썸네일 필드명 통일 및 URL 정규화, 관리번호 필드명 표준화
      const normalizedItems = items.map((item: any) => {
        // 썸네일 필드명 통일: 다양한 필드명을 확인하여 thumbnailUrl로 통일
        const rawThumbnailUrl = 
          item.thumbnailUrl || 
          item.thumbnail_url || 
          item.thumbnail ||
          item.thumbnailPath ||
          item.thumbnail_path ||
          item.thumbnailFileUrl ||
          item.thumbnail_file_url ||
          item.thumbnailImage ||
          item.thumbnail_image ||
          null;
        const normalizedThumbnailUrl = normalizeThumbnailUrl(rawThumbnailUrl, CMS_API_BASE);
        
        // 관리번호 필드명 표준화: 다양한 필드명을 videoManageNo로 통일
        const rawManageNo = 
          item.videoManageNo || 
          item.video_manage_no || 
          item.videoManagementNo ||
          item.video_management_no ||
          item.manageNo || 
          item.managementNo || 
          item.managementId || 
          item.management_no || 
          item.management_id ||
          item.managementNumber || 
          item.management_code ||
          item.adminCode || 
          item.code || 
          item.video_code || 
          item.adminId || 
          item.admin_id || 
          null;
        
        return {
          ...item,
          thumbnailUrl: normalizedThumbnailUrl,
          thumbnail_url: normalizedThumbnailUrl, // 하위 호환성
          videoManageNo: rawManageNo, // 표준 필드명으로 통일
        };
      });
      
      // 관리번호 기준 내림차순 정렬 (최신 영상이 먼저 오도록)
      const sortedItems = sortVideosByManagementNumber(normalizedItems);
      
      // #region agent log - 정렬 후 상태 업데이트 전
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminVideosPage.tsx:fetchVideos',message:'정렬 후 상태 업데이트 전',data:{sortedCount:sortedItems.length,firstFew:sortedItems.slice(0,3).map(v=>({id:v.id,title:v.title?.substring(0,20),manageNo:(v as any).manageNo,managementId:v.managementId}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      setVideos(sortedItems);
      setFilteredVideos(sortedItems);
    } catch (err) {
      // 네트워크 오류 등 예외 처리
      console.error("Failed to fetch videos:", err);
      const error = err as Error & { isNetworkError?: boolean; status?: number };
      
      // 네트워크 에러 또는 인증 에러 처리
      if (error.isNetworkError || error.status === 0) {
        setError("백엔드 서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해주세요.");
      } else if (error.status === 401 || error.status === 403) {
        setError("인증에 실패했습니다. 다시 로그인해주세요.");
      } else {
        setError(error.message || "목록을 불러오는 중 오류가 발생했습니다.");
      }
      
      // 에러 발생 시에도 이전 값 유지 (빈 배열로 초기화하지 않음)
      // 단, videos가 아직 초기화되지 않은 경우에만 빈 배열로 설정
      setVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
      setFilteredVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
    } finally {
      // 무한 로딩 방지를 위해 항상 loading을 false로 설정
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    // 검색 버튼 클릭 시 서버에서 필터링된 데이터를 가져옴
    setCurrentPage(1); // 검색 시 항상 1페이지로 초기화
    fetchVideos();
  };


  const handleView = (video: Video) => {
    setModalVideo(video);
  };

  const handleCloseModal = () => {
    setModalVideo(null);
  };

  const handleAddVideo = () => {
    setEditingVideo(null);
    setShowVideoFormModal(true);
  };

  const handleEditVideo = (video: Video) => {
    setEditingVideo(video);
    setShowVideoFormModal(true);
  };

  const handleCloseVideoFormModal = () => {
    setShowVideoFormModal(false);
    setEditingVideo(null);
  };

  // 저장 성공 시 리스트를 즉시 업데이트하는 핸들러
  const handleVideoSaved = (updatedVideo: Video) => {
    if (!updatedVideo || !updatedVideo.id) {
      console.warn("handleVideoSaved: invalid video object", updatedVideo);
      return;
    }

    console.log("handleVideoSaved: updating video in list", {
      id: updatedVideo.id,
      viewCountReal: updatedVideo.viewCountReal,
      viewDisplay: updatedVideo.viewDisplay,
      likeCountReal: updatedVideo.likeCountReal,
      likeDisplay: updatedVideo.likeDisplay,
      shareCountReal: updatedVideo.shareCountReal,
      shareDisplay: updatedVideo.shareDisplay,
    });

    // #region agent log - handleVideoSaved 시작
    fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminVideosPage.tsx:handleVideoSaved',message:'영상 저장 후 핸들러 시작',data:{videoId:updatedVideo.id,title:updatedVideo.title?.substring(0,20),manageNo:(updatedVideo as any).manageNo,managementId:updatedVideo.managementId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
    // #endregion

    // videos 상태 업데이트
    setVideos((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const index = safePrev.findIndex((v) => v.id === updatedVideo.id);
      let updated: Video[];
      if (index >= 0) {
        // 기존 항목 업데이트 (깊은 병합으로 모든 필드 업데이트)
        updated = [...safePrev];
        updated[index] = {
          ...updated[index],
          ...updatedVideo,
          // metrics 필드 명시적으로 업데이트
          viewCountReal: updatedVideo.viewCountReal ?? updated[index].viewCountReal,
          viewDisplay: updatedVideo.viewDisplay ?? updated[index].viewDisplay,
          likeCountReal: updatedVideo.likeCountReal ?? updated[index].likeCountReal,
          likeDisplay: updatedVideo.likeDisplay ?? updated[index].likeDisplay,
          shareCountReal: updatedVideo.shareCountReal ?? updated[index].shareCountReal,
          shareDisplay: updatedVideo.shareDisplay ?? updated[index].shareDisplay,
        };
      } else {
        // 새 항목이면 추가 (create 모드)
        updated = [...safePrev, updatedVideo];
      }
      
      // #region agent log - videos 상태 업데이트 후 정렬 전
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminVideosPage.tsx:handleVideoSaved',message:'videos 상태 업데이트 후 정렬 전',data:{totalCount:updated.length,firstFew:updated.slice(0,3).map(v=>({id:v.id,title:v.title?.substring(0,20),manageNo:(v as any).manageNo}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
      // #endregion
      
      // 관리번호 기준으로 정렬
      const sorted = sortVideosByManagementNumber(updated);
      
      // #region agent log - videos 정렬 후
      fetch('http://127.0.0.1:7242/ingest/2098aad9-a032-4516-a074-3af41b5bc195',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AdminVideosPage.tsx:handleVideoSaved',message:'videos 정렬 후',data:{totalCount:sorted.length,firstFew:sorted.slice(0,3).map(v=>({id:v.id,title:v.title?.substring(0,20),manageNo:(v as any).manageNo}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      return sorted;
    });
    
    // filteredVideos는 useEffect에서 videos 상태 변경을 감지하여 자동으로 업데이트됨
    // 따라서 여기서는 별도로 업데이트할 필요 없음
  };

  const handleVideoFormSubmit = async (updatedVideo?: Video) => {
    try {
      // 전체 목록을 다시 불러와서 최신 상태로 동기화
      await fetchVideos();
    } catch (err) {
      console.error("Failed to refresh videos after form submit:", err);
      // 에러 발생 시에도 화면은 유지 (이전 목록 계속 표시)
      setError("영상 목록을 새로고침하는데 실패했습니다. 페이지를 새로고침해 주세요.");
    }
  };

  const apiDeleteVideo = async (videoId: string): Promise<void> => {
    // role에 따라 API 엔드포인트 결정
    const userRole = (currentRole || user?.role || "admin") as "admin" | "creator";
    const apiPath = getVideoDeleteApiEndpoint(userRole, videoId);
    
    console.log(`[영상 삭제] 요청 URL: ${CMS_API_BASE}${apiPath}, videoId: ${videoId}, role: ${userRole}`);
    
    try {
      await apiDelete(apiPath, { auth: true });
      console.log(`[영상 삭제 성공] videoId: ${videoId}`);
    } catch (error: any) {
      const status = error.status;
      let errorMessage = `영상 삭제에 실패했습니다. (ID: ${videoId})`;
      
      // HTTP 상태 코드에 따라 더 정확한 에러 메시지 제공
      if (status === 403) {
        errorMessage = `접근 권한이 없습니다. (403 Forbidden)`;
      } else if (status === 404) {
        errorMessage = `영상을 찾을 수 없습니다. (404 Not Found)`;
      } else if (status === 500) {
        errorMessage = `서버 오류가 발생했습니다. (500 Internal Server Error)`;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      console.error(`[영상 삭제 실패] status: ${status}, message: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    try {
      await apiDeleteVideo(videoId);

      // 성공 시 즉시 UI에서 제거 (빠른 피드백)
      const safeVideos = Array.isArray(videos) ? videos : [];
      const updatedVideos = safeVideos.filter((v) => String(v.id) !== String(videoId));
      setVideos(updatedVideos);
      
      // 필터링된 목록도 업데이트
      const safeFiltered = Array.isArray(filteredVideos) ? filteredVideos : [];
      const updatedFiltered = safeFiltered.filter((v) => String(v.id) !== String(videoId));
      setFilteredVideos(updatedFiltered);
      
      // 선택 목록에서도 제거
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(videoId)));
      
      // 목록 재조회로 최신 상태 동기화 (백그라운드)
      fetchVideos().catch((err) => {
        console.warn("삭제 후 목록 재조회 실패 (무시됨):", err);
        // 재조회 실패해도 UI는 이미 업데이트되었으므로 무시
      });
    } catch (err) {
      console.error("Failed to delete video:", err);
      const errorMessage = err instanceof Error ? err.message : "삭제에 실패했습니다.";
      setError(errorMessage);
      // 에러 발생 시에도 기존 목록은 유지
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    
    if (!window.confirm(`선택된 ${selectedIds.length}개의 영상을 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const failedIds: string[] = [];
      
      // 각 영상을 순차적으로 삭제
      for (const id of selectedIds) {
        try {
          await apiDeleteVideo(id);
        } catch (err) {
          console.error(`Failed to delete video ${id}:`, err);
          failedIds.push(id);
        }
      }

      if (failedIds.length > 0) {
        setError(`${failedIds.length}개의 영상 삭제에 실패했습니다. 나머지는 삭제되었습니다.`);
      }

      // 성공한 항목만 상태에서 제거
      const successIds = selectedIds.filter((id) => !failedIds.includes(id));
      if (successIds.length > 0) {
        setVideos((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.filter((v) => !successIds.includes(String(v.id)));
        });
        setFilteredVideos((prev) => {
          const safePrev = Array.isArray(prev) ? prev : [];
          return safePrev.filter((v) => !successIds.includes(String(v.id)));
        });
        setSelectedIds((prev) => prev.filter((id) => !successIds.includes(id)));
      }
      
      // 목록 재조회로 최신 상태 동기화 (백그라운드)
      if (successIds.length > 0) {
        fetchVideos().catch((err) => {
          console.warn("대량 삭제 후 목록 재조회 실패 (무시됨):", err);
          // 재조회 실패해도 UI는 이미 업데이트되었으므로 무시
        });
      }
    } catch (err) {
      console.error("Failed to delete videos:", err);
      setError("선택된 영상 삭제 중 오류가 발생했습니다.");
      // 에러 발생 시에도 기존 목록은 유지
    }
  };

  const handleToggleSelect = (videoId: string, checked: boolean) => {
    if (checked) {
      // 추가, 최대 20개 제한
      setSelectedIds((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        if (safePrev.includes(videoId)) return safePrev;
        if (safePrev.length >= 20) {
          alert("한 번에 최대 20개까지만 선택할 수 있습니다.");
          return safePrev;
        }
        return [...safePrev, videoId];
      });
    } else {
      // 제거
      setSelectedIds((prev) => {
        const safePrev = Array.isArray(prev) ? prev : [];
        return safePrev.filter((id) => String(id) !== String(videoId));
      });
    }
  };

  // 페이지네이션 계산
  const list = Array.isArray(filteredVideos) && filteredVideos.length > 0 ? filteredVideos : (Array.isArray(videos) ? videos : []);
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedVideos = list.slice(startIndex, endIndex);

  // 페이지 이동 함수
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    // 페이지 이동 시 스크롤을 상단으로
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToFirst = () => goToPage(1);
  const goToLast = () => goToPage(totalPages);
  const goToPrev = () => goToPage(currentPage - 1);
  const goToNext = () => goToPage(currentPage + 1);

  // 현재 페이지 전체 선택/해제
  const handleToggleSelectAllCurrentPage = (checked: boolean) => {
    const idsOnPage = pagedVideos.map(v => String(v.id));
    if (checked) {
      setSelectedIds(prev => {
        const newIds = Array.from(new Set([...prev, ...idsOnPage]));
        // 최대 20개 제한
        if (newIds.length > 20) {
          alert("한 번에 최대 20개까지만 선택할 수 있습니다.");
          return prev;
        }
        return newIds;
      });
    } else {
      const setOnPage = new Set(idsOnPage);
      setSelectedIds(prev => prev.filter(id => !setOnPage.has(id)));
    }
  };

  const allCurrentPageSelected = 
    pagedVideos.length > 0 && 
    pagedVideos.every(v => selectedIds.includes(String(v.id)));

  // 크리에이터 필터 제거로 인해 creators 변수는 더 이상 필요 없음

  // 탭 제거로 인해 이 useEffect는 더 이상 필요 없음

  // 모달이 열릴 때 body 스크롤 방지
  useEffect(() => {
    if (modalVideo) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [modalVideo]);

  if (isLoading) {
    return (
      <div className="admin-videos-page">
        <div className="admin-loading">
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-videos-page">
      {/* 헤더: 제목과 액션 버튼 */}
      <div className="admin-videos-header">
        <h1 className="admin-videos-page-title">{isAdmin ? "Videos" : "My Videos"}</h1>
        <div className="admin-videos-header-actions">
          <button
            className="admin-videos-button admin-videos-button-primary"
            onClick={handleAddVideo}
          >
            영상 추가
          </button>
          <button
            className="admin-videos-button admin-videos-button-secondary"
            onClick={() => setShowBulkModal(true)}
          >
            대량 등록/편집
          </button>
        </div>
      </div>


      {/* 필터/검색 바 */}
      <div className="admin-card admin-videos-filter-card">
        <div className="admin-videos-filter-row">
          <input
            type="text"
            className="admin-videos-search-input"
            placeholder="제목, 설명, 영상 관리번호, 크리에이터, 날짜 검색"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "500" }}>조회 시작일자</label>
            <input
              type="date"
              className="admin-videos-date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "500" }}>조회 종료일자</label>
            <input
              type="date"
              className="admin-videos-date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <button className="admin-videos-search-button" onClick={handleSearch}>
            검색
          </button>
        </div>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="admin-videos-error">
          <p>{error}</p>
          <button
            onClick={() => setError(null)}
            style={{
              marginTop: "8px",
              padding: "4px 12px",
              background: "none",
              border: "1px solid #c33",
              borderRadius: "4px",
              color: "#c33",
              cursor: "pointer",
            }}
          >
            닫기
          </button>
        </div>
      )}

      {/* 일괄 작업 툴바 */}
      {selectedIds.length > 0 && (
        <div className="admin-card admin-videos-bulk-toolbar">
          <div className="admin-videos-bulk-info">
            <span>선택된 영상: {selectedIds.length}개 (최대 20개)</span>
          </div>
          <div className="admin-videos-bulk-actions">
            <button
              className="admin-videos-bulk-button admin-videos-bulk-delete"
              onClick={handleBulkDelete}
            >
              선택 삭제
            </button>
            <button
              className="admin-videos-bulk-button admin-videos-bulk-status"
              disabled
              title="추후 구현 예정"
            >
              선택 상태 수정
            </button>
          </div>
        </div>
      )}

      {/* 영상 리스트 */}
      <div className="admin-card">
        {(() => {
          // 빈 배열이면 "검색 결과가 없습니다." 표시 (API 오류가 아닌 경우)
          if (list.length === 0 && !error) {
            return (
              <div className="admin-videos-empty">
                <p>검색 결과가 없습니다.</p>
              </div>
            );
          }
          
          // API 오류가 있고 데이터가 없으면 빈 화면 (에러 메시지는 상단에 표시됨)
          if (list.length === 0 && error) {
            return (
              <div className="admin-videos-empty">
                <p>영상 목록을 불러올 수 없습니다.</p>
              </div>
            );
          }
          
          return (
            <>
            <div className="admin-videos-list">
              {/* 전체 선택 체크박스 (현재 페이지 기준) */}
              <div className="admin-videos-select-all">
                <input
                  type="checkbox"
                  checked={allCurrentPageSelected}
                  onChange={(e) => handleToggleSelectAllCurrentPage(e.target.checked)}
                  className="admin-videos-checkbox"
                />
                <label>전체 선택 (현재 페이지)</label>
              </div>

              {pagedVideos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  mode={isAdmin ? "admin" : "creator"}
                  isSelected={selectedIds.includes(String(video.id))}
                  onSelect={handleToggleSelect}
                  onView={handleView}
                  onEdit={handleEditVideo}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            
            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="admin-videos-pagination">
                <button
                  className="admin-videos-pagination-button"
                  onClick={goToFirst}
                  disabled={currentPage === 1}
                  title="첫 페이지"
                >
                  {'<<'}
                </button>
                <button
                  className="admin-videos-pagination-button"
                  onClick={goToPrev}
                  disabled={currentPage === 1}
                  title="이전 페이지"
                >
                  {'<'}
                </button>
                {Array.from({ length: totalPages }, (_, i) => {
                  const page = i + 1;
                  const isActive = page === currentPage;
                  return (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`admin-videos-pagination-button ${isActive ? 'admin-videos-pagination-button-active' : ''}`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  className="admin-videos-pagination-button"
                  onClick={goToNext}
                  disabled={currentPage === totalPages}
                  title="다음 페이지"
                >
                  {'>'}
                </button>
                <button
                  className="admin-videos-pagination-button"
                  onClick={goToLast}
                  disabled={currentPage === totalPages}
                  title="마지막 페이지"
                >
                  {'>>'}
                </button>
              </div>
            )}
            </>
          );
        })()}
      </div>

      {/* 영상 미리보기 모달 (VideoPreviewModal 사용) */}
      {modalVideo && (
        <VideoPreviewModal
          video={{
            id: modalVideo.id,
            title: modalVideo.title || "",
            video_type: (modalVideo.sourceType || (modalVideo as any).video_type || "youtube") as "youtube" | "facebook" | "file",
            youtube_id: (modalVideo as any).youtube_id,
            facebook_url: (modalVideo as any).facebook_url || modalVideo.videoUrl || (modalVideo as any).sourceUrl || (modalVideo as any).source_url,
            sourceUrl: modalVideo.videoUrl || (modalVideo as any).sourceUrl || (modalVideo as any).source_url,
            sourceType: modalVideo.sourceType || (modalVideo as any).video_type,
          }}
          onClose={handleCloseModal}
        />
      )}

      {/* 영상 추가/편집 모달 */}
      {showVideoFormModal && (
        <VideoFormModal
          mode={editingVideo ? "edit" : "create"}
          initialVideo={editingVideo}
          onSubmit={handleVideoFormSubmit}
          onClose={handleCloseVideoFormModal}
          onSaved={handleVideoSaved}
        />
      )}

      {/* 대량 등록/편집 모달 */}
      {showBulkModal && (
        <BulkVideosModal
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleVideoFormSubmit}
        />
      )}
    </div>
  );
}
