// NestJS API 베이스 URL
const NEST_API_BASE = 'http://localhost:8788';
const API_BASE = window.location.origin; // 레거시 API (사이트/Creator 관리용)

// ==================== JWT 인증 관리 ====================

/**
 * 페이지 로드 시 JWT 인증 체크
 */
window.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  displayUserInfo();
});

/**
 * JWT 토큰 인증 체크
 */
function checkAuthentication() {
  const token = getJwtToken();
  
  if (!token) {
    console.log('❌ JWT 토큰이 없습니다. 로그인 페이지로 이동합니다.');
    redirectToLogin();
    return;
  }

  // 토큰 만료 체크
  if (isTokenExpired()) {
    console.log('❌ JWT 토큰이 만료되었습니다. 로그인 페이지로 이동합니다.');
    clearAuthData();
    redirectToLogin();
    return;
  }

  console.log('✅ JWT 인증 확인 완료');
}

/**
 * JWT 토큰 가져오기
 */
function getJwtToken() {
  return localStorage.getItem('admin_jwt_token') || '';
}

/**
 * 사용자 정보 가져오기
 */
function getUserInfo() {
  const userJson = localStorage.getItem('admin_user');
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error('사용자 정보 파싱 에러:', error);
    return null;
  }
}

/**
 * 토큰 만료 확인
 */
function isTokenExpired() {
  const expiresAt = localStorage.getItem('admin_token_expires');
  if (!expiresAt) return false; // 만료 시간 정보가 없으면 만료되지 않은 것으로 간주
  
  const expireDate = new Date(expiresAt);
  const now = new Date();
  
  return now >= expireDate;
}

/**
 * 로그인 페이지로 리다이렉트
 */
function redirectToLogin() {
  window.location.href = '/login';
}

/**
 * 로그아웃
 */
function logout() {
  if (confirm('로그아웃하시겠습니까?')) {
    clearAuthData();
    window.location.href = '/login';
  }
}

/**
 * 인증 데이터 초기화
 */
function clearAuthData() {
  localStorage.removeItem('admin_jwt_token');
  localStorage.removeItem('admin_user');
  localStorage.removeItem('admin_token_expires');
}

/**
 * 사용자 정보 표시
 */
function displayUserInfo() {
  const user = getUserInfo();
  if (!user) return;

  // 헤더에 사용자 정보 표시 (있으면)
  const userInfoElement = document.getElementById('userInfo');
  if (userInfoElement) {
    userInfoElement.innerHTML = `
      <span>👤 ${user.name} (${user.role})</span>
      <button onclick="logout()" class="logout-btn">로그아웃</button>
    `;
  }
}

// ==================== API Key 관리 (레거시) ====================

function getApiKey() {
  return localStorage.getItem("admin_api_key") || "";
}

function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) {
    showError("apiKeyStatus", "API Key를 입력하세요.");
    return;
  }
  localStorage.setItem("admin_api_key", key);
  document.getElementById("apiKeyInput").value = "";
  showSuccess("apiKeyStatus", "API Key가 저장되었습니다.");
  loadSites();
  loadCreators();
}

function loadApiKey() {
  const key = getApiKey();
  if (key) {
    document.getElementById("apiKeyInput").value = key;
    loadSites();
    loadCreators();
  }
}

// API 호출 헬퍼
async function apiCall(endpoint, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다.");
  }

  const headers = {
    "x-api-key": apiKey,
    ...options.headers,
  };

  // DELETE 요청이 아니거나 body가 있을 때만 Content-Type 추가
  if (options.method !== "DELETE" || options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

// 메시지 표시
function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.innerHTML = `<div class="error">${message}</div>`;
  setTimeout(() => (el.innerHTML = ""), 5000);
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  el.innerHTML = `<div class="success">${message}</div>`;
  setTimeout(() => (el.innerHTML = ""), 3000);
}

// 사이트 관리
async function createSite() {
  const id = document.getElementById("siteIdInput").value.trim();
  const name = document.getElementById("siteNameInput").value.trim();

  if (!id || !name) {
    showError("apiKeyStatus", "사이트 ID와 이름을 입력하세요.");
    return;
  }

  try {
    await apiCall("/admin/sites", {
      method: "POST",
      body: JSON.stringify({ id, name }),
    });
    showSuccess("apiKeyStatus", "사이트가 생성되었습니다.");
    document.getElementById("siteIdInput").value = "";
    document.getElementById("siteNameInput").value = "";
    loadSites();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function loadSites() {
  try {
    const data = await apiCall("/admin/sites");
    const tbody = document.querySelector("#sitesTable tbody");
    tbody.innerHTML = "";

    if (data.sites.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4'>사이트가 없습니다.</td></tr>";
      return;
    }

    data.sites.forEach((site) => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = site.id;
      row.insertCell(1).textContent = site.name;
      row.insertCell(2).textContent = new Date(site.created_at).toLocaleString("ko-KR");
      const actionsCell = row.insertCell(3);
      actionsCell.innerHTML = `<button onclick="selectSiteForCreator('${site.id}')">선택</button>`;
    });

    // Creator 사이트 선택 드롭다운 업데이트
    const creatorSelect = document.getElementById("creatorSiteSelect");
    if (creatorSelect) {
      creatorSelect.innerHTML = '<option value="">전체</option>';
      data.sites.forEach((site) => {
        const option = document.createElement("option");
        option.value = site.id;
        option.textContent = `${site.id} - ${site.name}`;
        creatorSelect.appendChild(option);
      });
    }
    
    // 영상 관리 사이트 필터 업데이트
    const videoSiteFilter = document.getElementById("videoSiteFilter");
    if (videoSiteFilter) {
      videoSiteFilter.innerHTML = '<option value="">전체 사이트</option>';
      data.sites.forEach((site) => {
        const option = document.createElement("option");
        option.value = site.id;
        option.textContent = `${site.id} - ${site.name}`;
        videoSiteFilter.appendChild(option);
      });
    }
    
    // 접속자 통계 사이트 선택 업데이트
    const analyticsSiteSelect = document.getElementById("analyticsSiteSelect");
    if (analyticsSiteSelect) {
      analyticsSiteSelect.innerHTML = '<option value="">전체 사이트</option>';
      data.sites.forEach((site) => {
        const option = document.createElement("option");
        option.value = site.id;
        option.textContent = `${site.id} - ${site.name}`;
        analyticsSiteSelect.appendChild(option);
      });
    }
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

function selectSiteForCreator(siteId) {
  document.getElementById("creatorSiteSelect").value = siteId;
}

// Creator 관리
async function createCreator() {
  const siteId = document.getElementById("creatorSiteSelect").value;
  const name = document.getElementById("creatorNameInput").value.trim();
  const email = document.getElementById("creatorEmailInput").value.trim();
  const password = document.getElementById("creatorPasswordInput").value;

  if (!siteId || !name) {
    showError("apiKeyStatus", "사이트와 Creator 이름을 입력하세요.");
    return;
  }

  // 이메일과 비밀번호는 둘 다 입력하거나 둘 다 비워야 함
  if ((email && !password) || (!email && password)) {
    showError("apiKeyStatus", "이메일과 비밀번호를 모두 입력하거나 모두 비워두세요.");
    return;
  }

  if (password && password.length < 8) {
    showError("apiKeyStatus", "비밀번호는 최소 8자 이상이어야 합니다.");
    return;
  }

  try {
    const body = { site_id: siteId, name };
    if (email && password) {
      body.email = email;
      body.password = password;
    }

    const data = await apiCall("/admin/creators", {
      method: "POST",
      body: JSON.stringify(body),
    });

    // 결과 메시지 구성
    let message = `Creator "${name}"의 API Key`;
    if (email) {
      message += `\n\n이메일: ${email}\n비밀번호: ${password}`;
    }

    // API Key 모달 표시
    showApiKeyModal(data.api_key, message);
    document.getElementById("creatorNameInput").value = "";
    document.getElementById("creatorEmailInput").value = "";
    document.getElementById("creatorPasswordInput").value = "";
    loadCreators();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function loadCreators() {
  try {
    const siteId = document.getElementById("creatorSiteSelect").value;
    const endpoint = siteId
      ? `/admin/creators?site_id=${encodeURIComponent(siteId)}`
      : "/admin/creators";
    const data = await apiCall(endpoint);
    const tbody = document.querySelector("#creatorsTable tbody");
    tbody.innerHTML = "";

    if (data.creators.length === 0) {
      tbody.innerHTML = "<tr><td colspan='5'>Creator가 없습니다.</td></tr>";
      return;
    }

    data.creators.forEach((creator) => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = creator.id.substring(0, 8) + "...";
      row.insertCell(1).textContent = creator.name;
      row.insertCell(2).textContent = creator.site_id || "-";
      const statusCell = row.insertCell(3);
      const statusClass = creator.status === "active" ? "status-active" : "status-suspended";
      statusCell.innerHTML = `<span class="status-badge ${statusClass}">${creator.status}</span>`;
      const actionsCell = row.insertCell(4);
      const toggleText = creator.status === "active" ? "정지" : "활성화";
      const toggleStatus = creator.status === "active" ? "suspended" : "active";
      actionsCell.innerHTML = `
        <button onclick="toggleCreatorStatus('${creator.id}', '${toggleStatus}')" class="${
        creator.status === "suspended" ? "" : "danger"
      }">${toggleText}</button>
        <button onclick="rotateCreatorKey('${creator.id}')" class="secondary">키 재발급</button>
      `;
    });
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function toggleCreatorStatus(creatorId, newStatus) {
  try {
    await apiCall(`/admin/creators/${creatorId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    showSuccess("apiKeyStatus", "상태가 변경되었습니다.");
    loadCreators();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function rotateCreatorKey(creatorId) {
  if (!confirm("키를 재발급하시겠습니까? 기존 키는 더 이상 사용할 수 없습니다.")) {
    return;
  }

  try {
    const data = await apiCall(`/admin/creators/${creatorId}/rotate-key`, {
      method: "POST",
    });
    showApiKeyModal(data.api_key, "재발급된 API Key");
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

// API Key 모달
function showApiKeyModal(apiKey, title = "API Key") {
  const lines = title.split('\n');
  document.getElementById("modalApiKey").textContent = apiKey;
  document.querySelector("#apiKeyModal .modal-header").textContent = `⚠️ ${lines[0]} (1회만 표시)`;
  
  // 추가 정보가 있으면 표시
  if (lines.length > 1) {
    const additionalInfo = document.createElement('div');
    additionalInfo.style.cssText = 'margin-top: 15px; padding: 15px; background: #e6fffa; border-radius: 8px; white-space: pre-line; font-size: 14px; color: #234e52;';
    additionalInfo.textContent = lines.slice(1).join('\n');
    document.querySelector(".modal-content").insertBefore(additionalInfo, document.getElementById("modalApiKey").nextSibling);
  }
  
  document.getElementById("apiKeyModal").style.display = "block";
}

function closeApiKeyModal() {
  document.getElementById("apiKeyModal").style.display = "none";
}

// 모달 외부 클릭 시 닫기
window.onclick = function (event) {
  const modal = document.getElementById("apiKeyModal");
  if (event.target === modal) {
    closeApiKeyModal();
  }
};

// ==================== 영상 관리 ====================

/**
 * JWT 토큰 가져오기
 */
function getJwtToken() {
  return localStorage.getItem('admin_jwt_token') || '';
}

/**
 * NestJS API 호출 헬퍼 (JWT 인증)
 */
async function nestApiCall(endpoint, options = {}) {
  const token = getJwtToken();
  if (!token) {
    throw new Error('JWT 토큰이 없습니다. 로그인해주세요.');
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${NEST_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    clearAuthData();
    redirectToLogin();
    throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * 전체 영상 목록 조회 (관리자용)
 */
async function loadAllVideos() {
  try {
    const siteId = document.getElementById('videoSiteFilter')?.value || '';
    const platform = document.getElementById('videoPlatformFilter')?.value || '';
    
    // NestJS API 호출
    const videos = await nestApiCall('/videos');
    
    let filteredVideos = videos.videos || [];
    
    // 사이트 필터
    if (siteId) {
      // site_id 필터링은 백엔드에서 처리되므로 여기서는 추가 필터링 불필요
      // 하지만 현재 API는 사용자별 영상만 반환하므로, 모든 영상을 보려면 별도 엔드포인트 필요
    }
    
    // 플랫폼 필터
    if (platform) {
      filteredVideos = filteredVideos.filter(v => v.platform === platform);
    }
    
    const tbody = document.querySelector('#videosTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredVideos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">영상이 없습니다.</td></tr>';
      return;
    }
    
    filteredVideos.forEach((video) => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = video.title || '제목 없음';
      row.insertCell(1).textContent = video.platform || 'other';
      row.insertCell(2).textContent = video.site_id || '-';
      row.insertCell(3).textContent = video.owner_id ? video.owner_id.substring(0, 8) + '...' : '-';
      const visibilityCell = row.insertCell(4);
      const visibilityClass = video.visibility === 'public' ? 'status-active' : 'status-suspended';
      visibilityCell.innerHTML = `<span class="status-badge ${visibilityClass}">${video.visibility}</span>`;
      row.insertCell(5).textContent = video.language || '-';
      const createdDate = video.created_at ? new Date(video.created_at).toLocaleDateString('ko-KR') : '-';
      row.insertCell(6).textContent = createdDate;
      const actionsCell = row.insertCell(7);
      actionsCell.innerHTML = `
        <button onclick="viewVideo('${video.id}')" class="secondary" style="width: auto; margin: 2px;">보기</button>
        <button onclick="deleteVideo('${video.id}')" class="danger" style="width: auto; margin: 2px;">삭제</button>
      `;
    });
    
    showSuccess('videosStatus', `총 ${filteredVideos.length}개의 영상을 불러왔습니다.`);
  } catch (err) {
    showError('videosStatus', err.message);
  }
}

/**
 * 영상 보기 (모달)
 */
async function viewVideo(videoId) {
  try {
    const videos = await nestApiCall('/videos');
    const video = (videos.videos || []).find(v => v.id === videoId);
    
    if (!video) {
      alert('영상을 찾을 수 없습니다.');
      return;
    }
    
    openVideoModal(video);
  } catch (err) {
    alert(err.message);
  }
}

/**
 * 영상 삭제
 */
async function deleteVideo(videoId) {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }
  
  try {
    await nestApiCall(`/videos/${videoId}`, {
      method: 'DELETE',
    });
    showSuccess('videosStatus', '영상이 삭제되었습니다.');
    loadAllVideos();
  } catch (err) {
    showError('videosStatus', err.message);
  }
}

/**
 * 비디오 모달 열기
 */
function openVideoModal(video) {
  const modal = document.getElementById('videoModal');
  const inner = document.getElementById('videoModalInner');
  if (!modal || !inner) return;
  
  inner.innerHTML = getVideoEmbedHtml(video);
  modal.classList.remove('hidden');
}

/**
 * 비디오 모달 닫기
 */
function closeVideoModal() {
  const modal = document.getElementById('videoModal');
  const inner = document.getElementById('videoModalInner');
  if (!modal || !inner) return;
  
  inner.innerHTML = '';
  modal.classList.add('hidden');
}

/**
 * 플랫폼별 embed HTML 생성
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
 * YouTube 영상 ID 추출
 */
function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// ==================== 접속자 통계 ====================

/**
 * 접속자 통계 조회
 */
async function loadAnalytics() {
  try {
    const siteId = document.getElementById('analyticsSiteSelect')?.value || '';
    const period = document.getElementById('analyticsPeriodSelect')?.value || 'daily';
    
    if (!siteId) {
      showError('analyticsStatus', '사이트를 선택해주세요.');
      return;
    }
    
    // NestJS API 호출
    const data = await nestApiCall(`/admin/analytics?site_id=${encodeURIComponent(siteId)}&period=${period}`);
    
    const content = document.getElementById('analyticsContent');
    if (!content) return;
    
    content.innerHTML = `
      <div class="stats-card">
        <h3>📊 전체 통계</h3>
        <div class="stats-grid">
          <div class="stats-item">
            <div class="stats-item-label">총 방문자</div>
            <div class="stats-item-value">${data.total_visits || 0}</div>
          </div>
          <div class="stats-item">
            <div class="stats-item-label">국가 수</div>
            <div class="stats-item-value">${data.unique_countries || 0}</div>
          </div>
          <div class="stats-item">
            <div class="stats-item-label">언어 수</div>
            <div class="stats-item-value">${data.unique_languages || 0}</div>
          </div>
        </div>
      </div>
      
      <div class="stats-card">
        <h3>🌍 국가별 통계</h3>
        <table style="width: 100%; margin-top: 15px;">
          <thead>
            <tr>
              <th>국가 코드</th>
              <th>국가명</th>
              <th>방문 수</th>
            </tr>
          </thead>
          <tbody>
            ${(data.by_country || []).map(c => `
              <tr>
                <td>${c.country_code || '-'}</td>
                <td>${c.country_name || '-'}</td>
                <td>${c.count || 0}</td>
              </tr>
            `).join('') || '<tr><td colspan="3">데이터가 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="stats-card">
        <h3>🗣️ 언어별 통계</h3>
        <table style="width: 100%; margin-top: 15px;">
          <thead>
            <tr>
              <th>언어</th>
              <th>방문 수</th>
            </tr>
          </thead>
          <tbody>
            ${(data.by_language || []).map(l => `
              <tr>
                <td>${l.language || '-'}</td>
                <td>${l.count || 0}</td>
              </tr>
            `).join('') || '<tr><td colspan="2">데이터가 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
    
    showSuccess('analyticsStatus', '통계를 불러왔습니다.');
  } catch (err) {
    showError('analyticsStatus', err.message);
  }
}

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  loadApiKey();
  document.getElementById("creatorSiteSelect")?.addEventListener("change", loadCreators);
  document.getElementById("videoSiteFilter")?.addEventListener("change", loadAllVideos);
  document.getElementById("videoPlatformFilter")?.addEventListener("change", loadAllVideos);
  document.getElementById("analyticsSiteSelect")?.addEventListener("change", loadAnalytics);
  document.getElementById("analyticsPeriodSelect")?.addEventListener("change", loadAnalytics);
  
  // 사이트 목록 로드 후 드롭다운 업데이트
  loadSites().then(() => {
    // 영상 관리 사이트 필터 업데이트
    const videoSiteFilter = document.getElementById('videoSiteFilter');
    const analyticsSiteSelect = document.getElementById('analyticsSiteSelect');
    
    if (videoSiteFilter || analyticsSiteSelect) {
      // 사이트 목록은 loadSites()에서 이미 업데이트됨
      // 여기서는 추가 초기화만 수행
    }
  });
});

