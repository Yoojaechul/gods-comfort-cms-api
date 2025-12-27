import { useEffect, useState } from "react";
import { getApiBase } from "../config";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin-settings.css";
import "../styles/admin-common.css";

interface SiteInfo {
  id?: number;
  site_id?: number;
  name: string;
  base_url: string;
  api_url: string;
  domain?: string;
}

interface SiteFormData {
  name: string;
  base_url: string;
  api_url: string;
}

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [formData, setFormData] = useState<SiteFormData>({
    name: "",
    base_url: "",
    api_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteInfo();
    loadFromLocalStorage();
  }, []);

  // localStorage에서 사이트 정보 로드
  const loadFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem("site_info");
      if (stored) {
        const parsed = JSON.parse(stored);
        setFormData({
          name: parsed.name || "",
          base_url: parsed.base_url || "",
          api_url: parsed.api_url || "",
        });
      }
    } catch (err) {
      console.warn("localStorage에서 사이트 정보 로드 실패:", err);
    }
  };

  // localStorage에 사이트 정보 저장
  const saveToLocalStorage = (data: SiteFormData) => {
    try {
      localStorage.setItem("site_info", JSON.stringify(data));
    } catch (err) {
      console.warn("localStorage에 사이트 정보 저장 실패:", err);
    }
  };

  const fetchSiteInfo = async () => {
    setLoading(true);
    setError(null);
    
    // localStorage에 site_id가 있으면 먼저 확인 (API 호출 실패해도 사용 가능)
    const storedSiteId = localStorage.getItem("site_id");
    if (storedSiteId) {
      console.log("localStorage에서 site_id 확인:", storedSiteId);
    }
    
    // 여러 엔드포인트를 순차적으로 시도
    const endpoints = ["/sites", "/site", "/admin/site", "/admin/sites"];
    let siteData: SiteInfo | null = null;
    let lastError: Error | null = null;
    
    for (const endpoint of endpoints) {
    try {
        const response = await fetch(`${getApiBase()}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

        if (response.ok) {
          const data = await response.json();
          // 응답이 배열인 경우 첫 번째 항목 사용
          siteData = Array.isArray(data) ? data[0] : data;
          break; // 성공하면 루프 종료
        } else if (response.status === 404) {
          // 404면 다음 엔드포인트 시도
          continue;
        } else {
          // 404가 아닌 다른 에러면 상세 정보 수집
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || errorData.error || response.statusText}`);
        }
      } catch (err) {
        lastError = err as Error;
        // 404가 아닌 다른 에러면 다음 엔드포인트 시도하지 않음
        if (err instanceof Error && !err.message.includes("404") && !err.message.includes("not found")) {
          break;
        }
        continue;
      }
    }
    
    // site_id는 항상 "gods"로 고정
    localStorage.setItem("site_id", "gods");
    
    if (siteData) {
      setSiteInfo(siteData);
      // 폼 데이터에 백엔드에서 받은 값 채우기
      setFormData({
        name: siteData.name || "",
        base_url: siteData.base_url || "",
        api_url: siteData.api_url || "",
      });
      console.log("site_id 저장됨: gods");
    } else {
      // 사이트 정보가 없으면 localStorage에서 로드한 값 사용
      setSiteInfo(null);
      if (lastError) {
        console.warn("사이트 정보를 불러올 수 없습니다:", lastError.message);
        if (storedSiteId) {
          console.warn("localStorage에 site_id가 있으므로 계속 사용 가능:", storedSiteId);
      }
      }
    }
    
    setLoading(false);
  };

  // 기본값 채우기
  const fillDefaults = () => {
    setFormData({
      name: "God's Comfort Word",
      base_url: "https://www.godscomfortword.com",
      api_url: getApiBase(),
    });
    setError(null);
    setSuccessMessage(null);
  };

  // 저장 (백엔드 API 시도 후 localStorage fallback)
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    // 입력 검증
    if (!formData.name.trim()) {
      setError("사이트 이름을 입력해주세요.");
      setSaving(false);
      return;
    }
    if (!formData.base_url.trim()) {
      setError("홈페이지 주소를 입력해주세요.");
      setSaving(false);
      return;
    }
    if (!formData.api_url.trim()) {
      setError("API 주소를 입력해주세요.");
      setSaving(false);
      return;
    }

    try {
      // 백엔드 API 시도
      const endpoints = ["/sites", "/site", "/admin/site", "/admin/sites"];
      let success = false;
      let siteData: SiteInfo | null = null;
      let backendError: Error | null = null;

      // 기존 사이트가 있으면 PUT/PATCH, 없으면 POST
      const existingSiteId = siteInfo?.id || siteInfo?.site_id;
      const method = existingSiteId ? "PUT" : "POST";

      for (const endpoint of endpoints) {
        try {
          const url = existingSiteId 
            ? `${getApiBase()}${endpoint}/${existingSiteId}`
            : `${getApiBase()}${endpoint}`;
          
          const response = await fetch(url, {
            method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: formData.name.trim(),
              base_url: formData.base_url.trim(),
              api_url: formData.api_url.trim(),
              domain: formData.base_url.replace(/^https?:\/\//, "").split("/")[0],
            }),
          });

          if (response.ok) {
      const data = await response.json();
            siteData = Array.isArray(data) ? data[0] : data;
            success = true;
            break;
          } else if (response.status === 404) {
            continue;
          } else {
            const errorData = await response.json().catch(() => ({}));
            backendError = new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            continue;
          }
        } catch (err) {
          if (err instanceof Error && !err.message.includes("404") && !err.message.includes("not found")) {
            backendError = err;
            break;
          }
          continue;
        }
      }

      // site_id는 항상 "gods"로 고정 저장
      localStorage.setItem("site_id", "gods");
      
      if (success && siteData) {
        // 백엔드 저장 성공
        setSiteInfo(siteData);
        console.log("백엔드 저장 성공, site_id: gods");
        saveToLocalStorage(formData);
        setSuccessMessage("사이트 정보가 성공적으로 저장되었습니다. (site_id: gods)");
      } else {
        // 백엔드 저장 실패 → localStorage fallback
        console.warn("백엔드 저장 실패, localStorage에 저장합니다:", backendError?.message);
        
        saveToLocalStorage(formData);
        
        setSiteInfo({
          id: 0, // 표시용 (실제로는 "gods" 사용)
          site_id: 0,
          name: formData.name,
          base_url: formData.base_url,
          api_url: formData.api_url,
        });
        
        setSuccessMessage(
          `사이트 정보가 로컬에 저장되었습니다. (site_id: gods)\n` +
          `백엔드 API가 사용 불가능한 상태입니다. 백엔드가 복구되면 다시 시도해주세요.`
        );
      }
    } catch (err) {
      console.error("Failed to save site:", err);
      setError(err instanceof Error ? err.message : "사이트 정보 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-settings-loading">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <h2 className="admin-page-title">Settings</h2>
      <div className="admin-page-description" style={{ marginBottom: "24px" }}>
        <p>사이트 정보를 설정하고 저장할 수 있습니다.</p>
      </div>

      <h3 className="admin-settings-title">사이트 설정</h3>

      {error && (
        <div className="admin-settings-error" style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#fee", border: "1px solid #fcc", borderRadius: "4px" }}>
          <p style={{ margin: 0, color: "#c00" }}>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="admin-settings-success" style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#efe", border: "1px solid #cfc", borderRadius: "4px" }}>
          <p style={{ margin: 0, color: "#0c0", whiteSpace: "pre-line" }}>{successMessage}</p>
        </div>
      )}

      <div className="admin-settings-form" style={{ maxWidth: "600px" }}>
        <div className="admin-settings-field" style={{ marginBottom: "20px" }}>
          <label className="admin-settings-label" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            사이트 이름 *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="God's Comfort Word"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        <div className="admin-settings-field" style={{ marginBottom: "20px" }}>
          <label className="admin-settings-label" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            홈페이지 주소 *
          </label>
          <input
            type="url"
            value={formData.base_url}
            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            placeholder="https://www.godscomfortword.com"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        <div className="admin-settings-field" style={{ marginBottom: "20px" }}>
          <label className="admin-settings-label" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            API 주소 *
          </label>
          <input
            type="url"
            value={formData.api_url}
            onChange={(e) => setFormData({ ...formData, api_url: e.target.value })}
            placeholder={getApiBase()}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Site ID는 항상 "gods"로 고정 (단일 사이트 CMS) */}
        <div className="admin-settings-field" style={{ marginBottom: "20px" }}>
          <label className="admin-settings-label" style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Site ID
          </label>
          <div style={{ padding: "8px 12px", backgroundColor: "#f5f5f5", borderRadius: "4px", fontSize: "14px" }}>
            gods
          </div>
          </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
          <button
            onClick={fillDefaults}
            className="admin-settings-retry-button"
            style={{
              padding: "10px 20px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            기본값 채우기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="admin-settings-retry-button"
            style={{
              padding: "10px 20px",
              backgroundColor: saving ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "14px",
              flex: 1,
            }}
              >
            {saving ? "저장 중..." : "저장"}
          </button>
            </div>
          </div>

      {siteInfo && (
        <div className="admin-settings-notice" style={{ marginTop: "24px", padding: "16px", backgroundColor: "#f9f9f9", borderRadius: "4px" }}>
          <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
              현재 CMS는 위 홈페이지 설정을 기준으로 운영됩니다.
              <br />
              운영 서버(https://www.godscomfortword.com)에서는 이 설정을 통해 연동됩니다.
            </p>
        </div>
      )}
    </div>
  );
}

