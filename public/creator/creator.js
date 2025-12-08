
// =====================
//   JWT 인증 설정
// =====================

// 항상 JWT 사용
function getAuthType() {
  return "jwt";
}

// login.js에서 저장한 JWT 토큰 읽기
function getToken() {
  return localStorage.getItem("creator_jwt_token") || "";
}

// 토큰 만료 시간
function getTokenExpiry() {
  const expiry = localStorage.getItem("creator_token_expires");
  if (!expiry) return null;
  const timestamp = Date.parse(expiry);
  return isNaN(timestamp) ? null : timestamp;
}

// 사용자 정보 읽기
function getUser() {
  const raw = localStorage.getItem("creator_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("creator_user 파싱 오류:", e);
    return null;
  }
}

// 로그아웃 (JWT 관련 정보 모두 삭제 후 로그인 페이지로 이동)
function logout() {
  localStorage.removeItem("creator_jwt_token");
  localStorage.removeItem("creator_user");
  localStorage.removeItem("creator_token_expires");
  
  window.location.href = "/creator/login.html";
}

// 인증 체크 실행 플래그 (중복 실행 방지)
let checkAuthExecuting = false;

// 인증 체크 (index.html 실행 시 호출)
function checkAuth() {
  // 중복 실행 방지
  if (checkAuthExecuting) {
    console.log("[checkAuth] 이미 실행 중입니다. 중복 실행 방지.");
    return false;
  }
  
  checkAuthExecuting = true;
  
  try {
    // 1) creator_jwt_token 없으면 alert 후 /creator/login.html로 이동
    const token = getToken();
    if (!token) {
      console.log("[checkAuth] 토큰 없음");
      alert("인증이 만료되었습니다. 다시 로그인해주세요.");
      window.location.href = "/creator/login.html";
      return false;
    }

    // 2) creator_token_expires 값이 있고 현재 시간 >= 만료시간이면 alert 후 logout()
    const expiry = getTokenExpiry();
    if (expiry && Date.now() >= expiry) {
      console.log("[checkAuth] 토큰 만료됨");
      alert("인증이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      return false;
    }

    // 3) 정상일 경우 displayUserInfo() 실행
    displayUserInfo();
    console.log("[checkAuth] 인증 체크 통과, 토큰:", getToken());
    return true;
  } finally {
    // 실행 완료 후 플래그 해제 (약간의 지연 후)
    setTimeout(() => {
      checkAuthExecuting = false;
    }, 100);
  }
}

// index.html 상단 사용자 표시
function displayUserInfo() {
  const user = getUser();
  const el = document.getElementById("userDisplay");
  if (user && el) {
    el.textContent = `👤 ${user.name || user.email} (${user.role})`;
  }
}

// =====================
//   NestJS API 설정
// =====================

// NestJS API 서버 주소
const NEST_API_BASE = "http://localhost:8788";
// 전역 접근을 위해 window 객체에도 할당
window.NEST_API_BASE = NEST_API_BASE;

// =====================
//   영상 관리 함수
// =====================

// 전역 변수: 현재 영상 목록
let currentVideos = [];

/**
 * YouTube URL에서 videoId 추출
 * @param {string} url - YouTube URL
 * @returns {string|null} videoId 또는 null
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  // 다양한 YouTube URL 형식 지원
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/.*[?&]v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * 영상 썸네일 URL 생성
 * @param {object} video - 영상 객체
 * @returns {string|null} 썸네일 URL 또는 null
 */
function getVideoThumbnailUrl(video) {
  console.log('[thumbnail] 썸네일 URL 생성 시도', {
    platform: video.platform,
    url: video.url || video.source_url,
    thumbnail_url: video.thumbnail_url
  });

  // 1. thumbnail_url이 있으면 사용 (백엔드에서 이미 설정된 경우)
  if (video.thumbnail_url) {
    console.log('[thumbnail] DB에 저장된 썸네일 URL 사용:', video.thumbnail_url);
    return video.thumbnail_url;
  }
  
  // 2. platform이 youtube이고 url이 있으면 YouTube 썸네일 생성
  if (video.platform === 'youtube' && video.url) {
    const videoId = extractYouTubeVideoId(video.url);
    if (videoId) {
      const youtubeThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      console.log('[thumbnail] YouTube 썸네일 자동 생성:', youtubeThumbnail);
      return youtubeThumbnail;
    }
  }
  
  // 3. platform이 facebook인 경우
  // 백엔드에서 이미 thumbnail_url을 설정해주므로, 여기서는 fallback만 처리
  if (video.platform === 'facebook') {
    console.log('[thumbnail] Facebook 플랫폼 - 썸네일 URL이 없음 (백엔드에서 자동 생성 실패 또는 Access Token 없음)');
    return null;
  }
  
  // 4. 썸네일 없음
  console.log('[thumbnail] 썸네일 없음');
  return null;
}

/**
 * 영상 URL 열기 (새 탭) - 레거시 함수 (사용 안 함)
 * @param {string} url - 영상 URL
 * @deprecated 모달 팝업을 사용하세요
 */
function openVideoUrl(url) {
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * ID로 영상 객체 찾기
 * @param {string} id - 영상 ID
 * @returns {object|null} 영상 객체 또는 null
 */
function findVideoById(id) {
  return (currentVideos || []).find(v => v.id === id) || null;
}

/**
 * 플랫폼별 embed HTML 생성
 * @param {object} video - 영상 객체
 * @returns {string} embed HTML
 */
function getVideoEmbedHtml(video) {
  if (!video || !video.platform) {
    return '<p>재생할 영상을 찾을 수 없습니다.</p>';
  }

  // YouTube
  if (video.platform === 'youtube' && video.url) {
    const id = extractYouTubeVideoId(video.url);
    if (!id) {
      return '<p>YouTube 영상 ID를 찾을 수 없습니다.</p>';
    }
    const src = `https://www.youtube.com/embed/${id}?autoplay=1`;
    return `
      <iframe
        src="${src}"
        title="${video.title || 'YouTube video player'}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
      ></iframe>
    `;
  }

  // Facebook
  if (video.platform === 'facebook' && video.url) {
    const encoded = encodeURIComponent(video.url);
    const src = `https://www.facebook.com/plugins/video.php?href=${encoded}&show_text=0&autoplay=1`;
    return `
      <iframe
        src="${src}"
        title="${video.title || 'Facebook video player'}"
        style="border:none;overflow:hidden"
        scrolling="no"
        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
        allowfullscreen="true"
      ></iframe>
    `;
  }

  return '<p>이 플랫폼의 팝업 재생은 아직 지원하지 않습니다.</p>';
}

/**
 * ID로 비디오 모달 열기
 * @param {string} id - 영상 ID
 */
function openVideoModalById(id) {
  const video = findVideoById(id);
  if (!video) {
    console.error('[openVideoModalById] video not found:', id);
    alert('영상을 찾을 수 없습니다.');
    return;
  }
  openVideoModal(video);
}

/**
 * 비디오 모달 열기
 * @param {object} video - 영상 객체
 */
function openVideoModal(video) {
  const modal = document.getElementById('videoModal');
  const inner = document.getElementById('videoModalInner');
  if (!modal || !inner) {
    console.error('[openVideoModal] 모달 요소를 찾을 수 없습니다.');
    return;
  }

  console.log('[openVideoModal] 모달 열기:', video);
  inner.innerHTML = getVideoEmbedHtml(video);
  modal.classList.remove('hidden');
}

/**
 * 비디오 모달 닫기
 */
function closeVideoModal() {
  const modal = document.getElementById('videoModal');
  const inner = document.getElementById('videoModalInner');
  if (!modal || !inner) {
    console.error('[closeVideoModal] 모달 요소를 찾을 수 없습니다.');
    return;
  }

  console.log('[closeVideoModal] 모달 닫기');
  inner.innerHTML = '';
  modal.classList.add('hidden');
}

/**
 * 영상 삭제 버튼 클릭 핸들러
 * @param {HTMLElement} button - 클릭된 삭제 버튼 요소
 */
async function onClickDeleteVideo(button) {
  const videoId = button.getAttribute('data-id');
  
  if (!videoId) {
    console.error('[onClickDeleteVideo] videoId를 찾을 수 없습니다.');
    alert('영상 ID를 찾을 수 없습니다.');
    return;
  }

  // 확인 대화상자
  if (!confirm('정말 삭제할까요?')) {
    console.log('[onClickDeleteVideo] 사용자가 삭제를 취소했습니다.');
    return;
  }

  const token = getToken();
  if (!token) {
    console.error('[onClickDeleteVideo] 토큰이 없습니다.');
    alert('인증이 만료되었습니다. 다시 로그인해주세요.');
    checkAuth();
    return;
  }

  const apiBase = window.NEST_API_BASE || NEST_API_BASE || 'http://localhost:8788';
  const requestUrl = `${apiBase}/videos/${videoId}`;

  console.log('[onClickDeleteVideo] 영상 삭제 요청 시작');
  console.log('[onClickDeleteVideo] Video ID:', videoId);
  console.log('[onClickDeleteVideo] 요청 URL:', requestUrl);

  try {
    const response = await fetch(requestUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('[onClickDeleteVideo] 응답 상태:', response.status, response.statusText);

    if (response.status === 401 || response.status === 403) {
      console.error('[onClickDeleteVideo] 인증 실패 - 상태 코드:', response.status);
      alert('인증이 만료되었습니다. 다시 로그인해주세요.');
      logout();
      return;
    }

    if (response.status === 404) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || '영상을 찾을 수 없습니다.';
      console.error('[onClickDeleteVideo] 영상을 찾을 수 없음:', errorMessage);
      alert('영상을 찾을 수 없습니다.');
      return;
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || '삭제 권한이 없습니다.';
      console.error('[onClickDeleteVideo] 권한 없음:', errorMessage);
      alert('삭제 권한이 없습니다.');
      return;
    }

    if (response.status === 204) {
      // 204 No Content는 응답 본문이 없음
      console.log('[onClickDeleteVideo] 영상 삭제 성공');
      alert('영상이 삭제되었습니다.');
      
      // 영상 목록 새로고침
      console.log('[onClickDeleteVideo] loadVideos() 호출하여 목록 갱신');
      loadVideos();
      return;
    }

    // 기타 오류
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || '영상 삭제에 실패했습니다.';
      console.error('[onClickDeleteVideo] 서버 오류:', {
        status: response.status,
        statusText: response.statusText,
        error: errorMessage,
        data: errorData
      });
      alert('영상 삭제 중 오류가 발생했습니다.');
      return;
    }
  } catch (err) {
    console.error('[onClickDeleteVideo] 네트워크 오류:', err);
    console.error('[onClickDeleteVideo] 오류 상세:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    alert('영상 삭제 중 오류가 발생했습니다.');
  }
}

// 영상 목록 로드
async function loadVideos() {
  const token = getToken();

  if (!token) {
    alert("인증이 만료되었습니다. 다시 로그인해주세요.");
    window.location.href = "/creator/login.html";
    return;
  }

  console.log("[loadVideos] 토큰 포함하여 /videos 호출:", token);

  try {
    const response = await fetch(`${NEST_API_BASE}/videos`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      console.warn("[loadVideos] 401 Unauthorized → 토큰 문제");
      alert("인증이 만료되었습니다. 다시 로그인해주세요.");
      logout();
      return;
    }

    if (!response.ok) {
      console.error("[loadVideos] API 오류:", response.status, response.statusText);
      alert(`영상 목록을 불러오는 중 오류가 발생했습니다. (${response.status})`);
      return;
    }

    const videos = await response.json();
    console.log("[loadVideos] API 응답:", videos);

    // 영상 리스트 렌더링
    const listEl = document.getElementById('videosList');
    if (!listEl) {
      console.warn("[loadVideos] videosList 요소를 찾을 수 없습니다.");
      return;
    }

    // 응답 구조 확인 (NestJS는 videos 배열을 직접 반환하거나 { videos: [...] } 형식일 수 있음)
    const videoList = Array.isArray(videos) ? videos : (videos.videos || []);

    // 전역 변수에 저장 (모달에서 사용)
    currentVideos = videoList;

    if (videoList.length === 0) {
      listEl.innerHTML = '<p style="padding: 20px; color: #718096;">등록된 영상이 없습니다.</p>';
      return;
    }

    listEl.innerHTML = videoList.map(video => {
      const thumbnailUrl = getVideoThumbnailUrl(video);
      const videoUrl = video.url || video.source_url || null;
      const videoTitle = video.title || '제목 없음';
      
      // 썸네일 HTML 생성 (모달 팝업으로 재생)
      let thumbnailHtml = '';
      const thumbnailClickHandler = `onclick="openVideoModalById('${video.id}')" style="cursor: pointer;"`;
      
      if (thumbnailUrl) {
        thumbnailHtml = `
          <div style="position: relative; width: 120px; height: 90px;" ${thumbnailClickHandler}>
            <img 
              src="${thumbnailUrl}" 
              alt="${videoTitle}"
              style="width: 120px; height: 90px; border-radius: 8px; cursor: pointer; object-fit: cover;"
              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            />
            <div style="display: none; position: absolute; top: 0; left: 0; width: 120px; height: 90px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; align-items: center; justify-content: center; color: #718096; font-size: 12px; text-align: center; padding: 8px;">
              썸네일 없음
            </div>
          </div>
        `;
      } else {
        thumbnailHtml = `
          <div style="width: 120px; height: 90px; background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #718096; font-size: 12px; text-align: center; padding: 8px;" ${thumbnailClickHandler}>
            썸네일 없음
          </div>
        `;
      }
      
      // 제목 클릭 핸들러 (모달 팝업으로 재생)
      const titleClickHandler = `onclick="openVideoModalById('${video.id}')" style="cursor: pointer; color: #3182ce;"`
      
      return `
        <div style="padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px; background: white; display: flex; gap: 16px;">
          <div style="flex-shrink: 0;">
            ${thumbnailHtml}
          </div>
          <div style="flex: 1; min-width: 0;">
            <h3 
              style="margin-bottom: 8px;"
              ${titleClickHandler}
            >
              ${videoTitle}
            </h3>
            <p style="color: #718096; font-size: 14px; margin-bottom: 8px;">
              ${video.platform || 'N/A'} | ${video.visibility || 'N/A'}
            </p>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button onclick="editVideo('${video.id}')" class="secondary" style="width: auto; padding: 8px 16px;">수정</button>
              <button class="btn-delete danger" data-id="${video.id}" onclick="onClickDeleteVideo(this)" style="width: auto; padding: 8px 16px;">삭제</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    console.log(`[loadVideos] 영상 목록 렌더링 완료 (${videoList.length}개)`);
  } catch (err) {
    console.error("[loadVideos] 오류:", err);
    alert('영상 목록을 불러오는 중 오류가 발생했습니다: ' + err.message);
  }
}

// =====================
//   자동 초기화
// =====================

// DOMContentLoaded 이벤트에서 자동으로 loadVideos() 호출
if (document.readyState === 'loading') {
  // 문서가 아직 로딩 중이면 이벤트 리스너 등록
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[creator.js] DOMContentLoaded - 자동 초기화 시작');
    
    // 인증 체크 후 loadVideos() 호출
    if (checkAuth()) {
      console.log('[creator.js] 인증 체크 통과, loadVideos() 호출');
      loadVideos();
    } else {
      console.warn('[creator.js] 인증 체크 실패, loadVideos() 호출 안 함');
    }
  });
} else {
  // 문서가 이미 로드되었으면 즉시 실행
  console.log('[creator.js] 문서 이미 로드됨 - 즉시 초기화');
  if (checkAuth()) {
    console.log('[creator.js] 인증 체크 통과, loadVideos() 호출');
    loadVideos();
  } else {
    console.warn('[creator.js] 인증 체크 실패, loadVideos() 호출 안 함');
  }
}
