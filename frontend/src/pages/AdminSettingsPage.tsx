import { useEffect, useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin-settings.css";
import "../styles/admin-common.css";

interface SiteInfo {
  name: string;
  base_url: string;
  api_url: string;
}

export default function AdminSettingsPage() {
  const { token } = useAuth();
  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSiteInfo();
  }, []);

  const fetchSiteInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${CMS_API_BASE}/admin/site`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("사이트 정보를 불러오는데 실패했습니다.");
      }

      const data = await response.json();
      setSiteInfo(data);
    } catch (err) {
      console.error("Failed to fetch site info:", err);
      setError(err instanceof Error ? err.message : "사이트 정보를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-settings-loading">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-settings-error">
        <h3>오류 발생</h3>
        <p>{error}</p>
        <button onClick={fetchSiteInfo} className="admin-settings-retry-button">
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <h2 className="admin-page-title">Settings</h2>
      <div className="admin-page-description" style={{ marginBottom: "24px" }}>
        <p>이 페이지에서는 다음 기능을 제공합니다:</p>
        <ul>
          <li>관리자 프로필 수정</li>
          <li>비밀번호 변경</li>
          <li>CMS에서 관리하는 홈페이지 주소 + key 값 CRUD</li>
        </ul>
        <p className="admin-page-note">※ 실제 기능 구현은 추후 진행됩니다.</p>
      </div>

      <h3 className="admin-settings-title">사이트 설정</h3>

      {siteInfo ? (
        <div className="admin-settings-info">
          <div className="admin-settings-field">
            <label className="admin-settings-label">사이트 이름</label>
            <div className="admin-settings-value">{siteInfo.name}</div>
          </div>

          <div className="admin-settings-field">
            <label className="admin-settings-label">홈페이지 주소</label>
            <div className="admin-settings-value">
              <a
                href={siteInfo.base_url}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-settings-link"
              >
                {siteInfo.base_url}
              </a>
            </div>
          </div>

          <div className="admin-settings-field">
            <label className="admin-settings-label">API 주소</label>
            <div className="admin-settings-value">{siteInfo.api_url}</div>
          </div>

          <div className="admin-settings-notice">
            <p>
              현재 CMS는 위 홈페이지 설정을 기준으로 운영됩니다.
              <br />
              운영 서버(https://www.godscomfortword.com)에서는 이 설정을 통해 연동됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div className="admin-settings-empty">
          <p>사이트 정보를 불러올 수 없습니다.</p>
        </div>
      )}
    </div>
  );
}

