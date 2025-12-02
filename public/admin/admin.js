const API_BASE = window.location.origin;

// API Key 관리
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
    const select = document.getElementById("creatorSiteSelect");
    select.innerHTML = '<option value="">전체</option>';
    data.sites.forEach((site) => {
      const option = document.createElement("option");
      option.value = site.id;
      option.textContent = `${site.id} - ${site.name}`;
      select.appendChild(option);
    });
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

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  loadApiKey();
  document.getElementById("creatorSiteSelect").addEventListener("change", loadCreators);
});

