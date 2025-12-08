import { useEffect, useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import type { Video } from "../types/video";
import VideoFormModal from "../components/admin/VideoFormModal";
import BulkVideosModal from "../components/admin/BulkVideosModal";
import VideoPreviewModal from "../components/VideoPreviewModal";
import "../styles/admin-videos.css";
import "../styles/admin-common.css";

export default function AdminVideosPage() {
  const { token } = useAuth();
  
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
      // 서버에서 필터링된 데이터를 받았으므로 그대로 사용
      setFilteredVideos(videos);
      // 데이터가 변경되면 현재 페이지가 유효한 범위인지 확인
      const totalPages = Math.max(1, Math.ceil(videos.length / pageSize));
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
      
      // API 엔드포인트: /videos
      const url = `${CMS_API_BASE}/videos${queryString}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // API 오류 처리 (404, 500 등)
      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text();
        
        // 콘솔에만 상세 에러 로그
        console.error(`API Error [${status}]:`, {
          url,
          status,
          statusText: response.statusText,
          errorText,
        });
        
        // 화면에는 사용자 친화적 메시지만 표시
        setError("목록을 불러오는 중 오류가 발생했습니다.");
        
        // 에러 발생 시에도 이전 값 유지 (빈 배열로 초기화하지 않음)
        // 단, videos가 아직 초기화되지 않은 경우에만 빈 배열로 설정
        setVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
        setFilteredVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      
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
      
      // 성공 시에만 상태 업데이트
      // 빈 배열이어도 정상 응답이므로 상태 업데이트 (화면에 "검색 결과가 없습니다." 표시)
      setVideos(items);
      setFilteredVideos(items);
    } catch (err) {
      // 네트워크 오류 등 예외 처리
      console.error("Failed to fetch videos:", err);
      
      // 화면에는 사용자 친화적 메시지만 표시
      setError("목록을 불러오는 중 오류가 발생했습니다.");
      
      // 에러 발생 시에도 이전 값 유지 (빈 배열로 초기화하지 않음)
      // 단, videos가 아직 초기화되지 않은 경우에만 빈 배열로 설정
      setVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
      setFilteredVideos((prev) => (Array.isArray(prev) && prev.length > 0 ? prev : []));
    } finally {
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

    // videos 상태 업데이트
    setVideos((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const index = safePrev.findIndex((v) => v.id === updatedVideo.id);
      if (index >= 0) {
        // 기존 항목 업데이트 (깊은 병합으로 모든 필드 업데이트)
        const updated = [...safePrev];
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
        return updated;
      } else {
        // 새 항목이면 추가 (create 모드)
        return [...safePrev, updatedVideo];
      }
    });
    
    // filteredVideos 상태도 업데이트
    setFilteredVideos((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const index = safePrev.findIndex((v) => v.id === updatedVideo.id);
      if (index >= 0) {
        // 기존 항목 업데이트 (깊은 병합으로 모든 필드 업데이트)
        const updated = [...safePrev];
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
        return updated;
      } else {
        // 새 항목이면 추가 (create 모드)
        return [...safePrev, updatedVideo];
      }
    });
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
    const response = await fetch(`${CMS_API_BASE}/admin/videos/${videoId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `영상 삭제에 실패했습니다. (ID: ${videoId})`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        // JSON 파싱 실패 시 기본 메시지 사용
      }
      throw new Error(errorMessage);
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!window.confirm("정말 삭제하시겠습니까?")) {
      return;
    }

    try {
      await apiDeleteVideo(videoId);

      // 성공 시 상태에서 제거 (안전하게 배열 체크)
      const safeVideos = Array.isArray(videos) ? videos : [];
      const updatedVideos = safeVideos.filter((v) => String(v.id) !== String(videoId));
      setVideos(updatedVideos);
      
      // 필터링된 목록도 업데이트
      const safeFiltered = Array.isArray(filteredVideos) ? filteredVideos : [];
      const updatedFiltered = safeFiltered.filter((v) => String(v.id) !== String(videoId));
      setFilteredVideos(updatedFiltered);
      
      // 선택 목록에서도 제거
      setSelectedIds((prev) => prev.filter((id) => String(id) !== String(videoId)));
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
        <h1 className="admin-videos-page-title">Videos</h1>
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

              {pagedVideos.map((video) => {
              const thumbnailUrl = video.thumbnailUrl || video.thumbnail_url;
              const creatorName = video.creatorName || video.creator_name || video.creator || "Unknown";
              // created_at 필드를 우선적으로 사용, 없으면 다른 필드들 확인
              const uploadDate = (video as any).created_at || video.uploadedAt || video.upload_date || video.createdAt;
              const viewCountReal = video.viewCountReal ?? 0;
              const viewDisplay = video.viewDisplay ?? 0;
              const likeCountReal = video.likeCountReal ?? 0;
              const likeDisplay = video.likeDisplay ?? 0;
              const shareCountReal = video.shareCountReal ?? 0;
              const shareDisplay = video.shareDisplay ?? 0;

              return (
                <div key={video.id} className="admin-videos-item">
                  <div className="admin-videos-item-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(String(video.id))}
                      onChange={(e) => handleToggleSelect(String(video.id), e.target.checked)}
                      className="admin-videos-checkbox"
                    />
                  </div>
                  <div className="admin-videos-item-thumbnail">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt={video.title} />
                    ) : (
                      <div className="admin-videos-thumbnail-placeholder">
                        <span className="admin-videos-thumbnail-icon">🎬</span>
                      </div>
                    )}
                  </div>
                  <div className="admin-videos-item-content">
                    <h3 className="admin-videos-item-title">{video.title}</h3>
                    <div className="admin-videos-item-meta">
                      {(video.managementId || video.video_code) && (
                        <span className="admin-videos-item-code" style={{ fontSize: "12px", color: "#666", marginRight: "8px" }}>
                          영상 관리번호: {video.managementId || video.video_code}
                        </span>
                      )}
                      <span className="admin-videos-item-creator">
                        크리에이터: {creatorName}
                      </span>
                      <span className="admin-videos-item-date">
                        {uploadDate
                          ? new Date(uploadDate).toLocaleDateString("ko-KR")
                          : "날짜 없음"}
                      </span>
                    </div>
                    <div className="admin-videos-item-metrics">
                      <span className="admin-videos-metric">
                        조회: 실제 {viewCountReal.toLocaleString()} / 노출 {viewDisplay.toLocaleString()}
                      </span>
                      <span className="admin-videos-metric">
                        좋아요: 실제 {likeCountReal.toLocaleString()} / 노출 {likeDisplay.toLocaleString()}
                      </span>
                      <span className="admin-videos-metric">
                        공유: 실제 {shareCountReal.toLocaleString()} / 노출 {shareDisplay.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="admin-videos-item-actions">
                    <button
                      className="admin-videos-action-button admin-videos-action-view"
                      onClick={() => handleView(video)}
                    >
                      보기
                    </button>
                    <button
                      className="admin-videos-action-button admin-videos-action-edit"
                      onClick={() => handleEditVideo(video)}
                    >
                      편집
                    </button>
                    <button
                      className="admin-videos-action-button admin-videos-action-delete"
                      onClick={() => handleDelete(String(video.id))}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              );
            })}
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
