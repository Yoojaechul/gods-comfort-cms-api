const API_BASE = window.location.origin;
let sessionCheckInterval = null;
let alarmShown = { ten: false, five: false, one: false };

// 인증 정보 가져오기
function getAuthType() {
  return localStorage.getItem("creator_auth_type") || "apikey";
}

function getApiKey() {
  return localStorage.getItem("creator_api_key") || "";
}

function getToken() {
  return localStorage.getItem("creator_token") || "";
}

function getTokenExpiry() {
  return parseInt(localStorage.getItem("creator_token_expiry")) || 0;
}

function saveApiKey() {
  const key = document.getElementById("apiKeyInput").value.trim();
  if (!key) {
    showError("apiKeyStatus", "API Key를 입력하세요.");
    return;
  }
  localStorage.setItem("creator_api_key", key);
  localStorage.setItem("creator_auth_type", "apikey");
  document.getElementById("apiKeyInput").value = "";
  showSuccess("apiKeyStatus", "API Key가 저장되었습니다.");
  loadUserInfo();
  loadVideos();
  loadProviderKeys();
}

function loadApiKey() {
  const authType = getAuthType();
  
  // API Key 방식인 경우에만 표시
  if (authType === "apikey") {
    document.getElementById("apiKeySection").style.display = "block";
    const key = getApiKey();
    if (key) {
      document.getElementById("apiKeyInput").value = key;
    }
  }
  
  loadUserInfo();
  loadVideos();
  loadProviderKeys();
}

// API 호출 헬퍼
async function apiCall(endpoint, options = {}) {
  const authType = getAuthType();
  const headers = { ...options.headers };

  // 인증 헤더 추가
  if (authType === "jwt") {
    const token = getToken();
    if (!token) {
      logout();
      throw new Error("로그인이 필요합니다.");
    }
    headers["Authorization"] = `Bearer ${token}`;
  } else {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("API Key가 설정되지 않았습니다.");
    }
    headers["x-api-key"] = apiKey;
  }

  // DELETE 요청이 아니거나 body가 있을 때만 Content-Type 추가
  if (options.method !== "DELETE" || options.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // 401 에러면 로그아웃
    if (response.status === 401) {
      logout();
    }
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

// 사용자 정보 로드
async function loadUserInfo() {
  try {
    const data = await apiCall("/me");
    document.getElementById("userName").textContent = data.name;
    document.getElementById("userSite").textContent = data.site?.name || data.site_id || "-";
    document.getElementById("userInfo").style.display = "block";
  } catch (err) {
    document.getElementById("userInfo").style.display = "none";
  }
}

// 영상 관리
async function createVideo() {
  const platform = document.getElementById("videoPlatform").value;
  const sourceUrl = document.getElementById("videoSourceUrl").value.trim();
  const title = document.getElementById("videoTitle").value.trim() || null;
  const thumbnail = document.getElementById("videoThumbnail").value.trim() || null;
  const visibility = document.getElementById("videoVisibility").value;

  if (!sourceUrl) {
    showError("apiKeyStatus", "소스 URL을 입력하세요.");
    return;
  }

  try {
    await apiCall("/videos", {
      method: "POST",
      body: JSON.stringify({
        platform,
        source_url: sourceUrl,
        title: title || undefined,
        thumbnail_url: thumbnail || undefined,
        visibility,
      }),
    });
    showSuccess("apiKeyStatus", "영상이 등록되었습니다.");
    document.getElementById("videoSourceUrl").value = "";
    document.getElementById("videoTitle").value = "";
    document.getElementById("videoThumbnail").value = "";
    loadVideos();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function loadVideos() {
  try {
    const data = await apiCall("/videos");
    const tbody = document.querySelector("#videosTable tbody");
    tbody.innerHTML = "";

    if (data.videos.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'>등록된 영상이 없습니다.</td></tr>";
      return;
    }

    data.videos.forEach((video) => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = video.platform;
      row.insertCell(1).textContent = video.title || "-";
      const thumbCell = row.insertCell(2);
      if (video.thumbnail_url) {
        const img = document.createElement("img");
        img.src = video.thumbnail_url;
        img.className = "thumbnail-preview";
        img.onerror = () => (img.style.display = "none");
        thumbCell.appendChild(img);
      } else {
        thumbCell.textContent = "-";
      }
      const visibilityCell = row.insertCell(3);
      const visibilityClass =
        video.visibility === "public" ? "status-public" : "status-private";
      visibilityCell.innerHTML = `<span class="status-badge ${visibilityClass}">${video.visibility}</span>`;
      row.insertCell(4).textContent = new Date(video.created_at).toLocaleString("ko-KR");
      const actionsCell = row.insertCell(5);
      actionsCell.innerHTML = `
        <button onclick="editVideo('${video.id}')" class="secondary">수정</button>
        <button onclick="deleteVideo('${video.id}')" class="danger">삭제</button>
      `;
    });
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

let currentEditVideoId = null;

async function editVideo(videoId) {
  try {
    // 현재 영상 정보 가져오기
    const data = await apiCall("/videos");
    const video = data.videos.find(v => v.id === videoId);
    
    if (!video) {
      showError("apiKeyStatus", "영상을 찾을 수 없습니다.");
      return;
    }
    
    // 모달에 현재 값 채우기
    currentEditVideoId = videoId;
    document.getElementById("editTitle").value = video.title || "";
    document.getElementById("editThumbnail").value = video.thumbnail_url || "";
    document.getElementById("editVisibility").value = video.visibility;
    
    // 모달 표시
    document.getElementById("editVideoModal").style.display = "block";
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function saveVideoEdit() {
  if (!currentEditVideoId) return;
  
  const title = document.getElementById("editTitle").value.trim();
  const thumbnail = document.getElementById("editThumbnail").value.trim();
  const visibility = document.getElementById("editVisibility").value;
  
  try {
    await apiCall(`/videos/${currentEditVideoId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: title || undefined,
        thumbnail_url: thumbnail || undefined,
        visibility: visibility,
      }),
    });
    showSuccess("apiKeyStatus", "영상이 수정되었습니다.");
    closeEditModal();
    loadVideos();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

function closeEditModal() {
  document.getElementById("editVideoModal").style.display = "none";
  currentEditVideoId = null;
}

async function deleteVideo(videoId) {
  if (!confirm("이 영상을 삭제하시겠습니까?")) {
    return;
  }

  try {
    await apiCall(`/videos/${videoId}`, {
      method: "DELETE",
    });
    showSuccess("apiKeyStatus", "영상이 삭제되었습니다.");
    loadVideos();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

// 플랫폼 키 관리
async function saveProviderKey() {
  const provider = document.getElementById("keyProvider").value;
  const keyName = document.getElementById("keyName").value.trim();
  const keyValue = document.getElementById("keyValue").value.trim();

  if (!keyName || !keyValue) {
    showError("apiKeyStatus", "키 이름과 키 값을 입력하세요.");
    return;
  }

  try {
    await apiCall("/my/provider-keys", {
      method: "PUT",
      body: JSON.stringify({
        provider,
        key_name: keyName,
        key_value: keyValue,
      }),
    });
    showSuccess("apiKeyStatus", "플랫폼 키가 저장되었습니다.");
    document.getElementById("keyName").value = "";
    document.getElementById("keyValue").value = "";
    loadProviderKeys();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function loadProviderKeys() {
  try {
    const data = await apiCall("/my/provider-keys");
    const tbody = document.querySelector("#keysTable tbody");
    tbody.innerHTML = "";

    if (data.keys.length === 0) {
      tbody.innerHTML = "<tr><td colspan='3'>저장된 키가 없습니다.</td></tr>";
      return;
    }

    data.keys.forEach((key) => {
      const row = tbody.insertRow();
      row.insertCell(0).textContent = key.provider;
      row.insertCell(1).textContent = key.key_name;
      const actionsCell = row.insertCell(2);
      actionsCell.innerHTML = `
        <button onclick="deleteProviderKey('${key.id}')" class="danger">삭제</button>
      `;
    });
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

async function deleteProviderKey(keyId) {
  if (!confirm("이 키를 삭제하시겠습니까?")) {
    return;
  }

  try {
    await apiCall(`/my/provider-keys/${keyId}`, {
      method: "DELETE",
    });
    showSuccess("apiKeyStatus", "키가 삭제되었습니다.");
    loadProviderKeys();
  } catch (err) {
    showError("apiKeyStatus", err.message);
  }
}

// 플랫폼 변경 시 안내 문구 업데이트
function updatePlatformHelp() {
  const platform = document.getElementById("videoPlatform").value;
  const label = document.getElementById("sourceUrlLabel");
  const input = document.getElementById("videoSourceUrl");
  
  if (platform === "facebook") {
    label.innerHTML = '소스 URL * <span style="color: #f56565; font-size: 13px;">(동영상 상단 URL을 복사 후 붙여넣기)</span>';
    input.placeholder = "https://www.facebook.com/watch/?v=... 또는 /videos/...";
  } else if (platform === "youtube") {
    label.textContent = "소스 URL *";
    input.placeholder = "https://www.youtube.com/watch?v=...";
  } else {
    label.textContent = "소스 URL *";
    input.placeholder = "영상 URL을 입력하세요";
  }
}

// 로그아웃
function logout() {
  localStorage.removeItem("creator_api_key");
  localStorage.removeItem("creator_token");
  localStorage.removeItem("creator_token_expiry");
  localStorage.removeItem("creator_auth_type");
  
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }
  
  window.location.href = "/creator/login.html";
}

// 세션 만료 체크 및 알람
function startSessionCheck() {
  const authType = getAuthType();
  
  // API Key 방식은 만료 없음
  if (authType !== "jwt") {
    return;
  }
  
  // 1분마다 체크
  sessionCheckInterval = setInterval(() => {
    const expiry = getTokenExpiry();
    if (!expiry) return;
    
    const now = Date.now();
    const remaining = expiry - now;
    const remainingMinutes = Math.floor(remaining / 1000 / 60);
    
    // 만료됨
    if (remaining <= 0) {
      clearInterval(sessionCheckInterval);
      alert('⏰ 세션이 만료되었습니다. 다시 로그인해주세요.');
      logout();
      return;
    }
    
    // 10분 전 알람
    if (remainingMinutes <= 10 && remainingMinutes > 9 && !alarmShown.ten) {
      alarmShown.ten = true;
      showSessionAlert('10분');
    }
    
    // 5분 전 알람
    if (remainingMinutes <= 5 && remainingMinutes > 4 && !alarmShown.five) {
      alarmShown.five = true;
      showSessionAlert('5분');
    }
    
    // 1분 전 알람
    if (remainingMinutes <= 1 && remainingMinutes > 0 && !alarmShown.one) {
      alarmShown.one = true;
      showSessionAlert('1분');
    }
  }, 60000); // 1분마다
}

function showSessionAlert(time) {
  const alertDiv = document.createElement('div');
  alertDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #f56565, #c53030);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(245, 101, 101, 0.4);
    z-index: 10000;
    font-size: 16px;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;
  alertDiv.innerHTML = `
    ⏰ 세션 만료 ${time} 전입니다!
    <div style="font-size: 14px; margin-top: 8px; font-weight: 400;">
      계속 작업하시려면 저장 후 다시 로그인하세요.
    </div>
  `;
  
  document.body.appendChild(alertDiv);
  
  // 10초 후 자동 제거
  setTimeout(() => {
    alertDiv.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => alertDiv.remove(), 300);
  }, 10000);
}

// 로그인 체크
function checkAuth() {
  const authType = getAuthType();
  
  if (authType === "jwt") {
    const token = getToken();
    const expiry = getTokenExpiry();
    
    if (!token || !expiry || Date.now() >= expiry) {
      logout();
      return false;
    }
  } else {
    const apiKey = getApiKey();
    if (!apiKey) {
      logout();
      return false;
    }
  }
  
  return true;
}

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  // 로그인 체크
  if (!checkAuth()) {
    return;
  }
  
  loadApiKey();
  
  // 플랫폼 변경 이벤트 리스너
  document.getElementById("videoPlatform").addEventListener("change", updatePlatformHelp);
  
  // 초기 안내 문구 설정
  updatePlatformHelp();
  
  // 세션 만료 체크 시작
  startSessionCheck();
});

// CSS 애니메이션 추가
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(400px); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(400px); opacity: 0; }
  }
`;
document.head.appendChild(style);

