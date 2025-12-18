import { useEffect, useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { formatDateTimeKST } from "../utils/date";
import "../styles/admin-common.css";

interface Creator {
  id: string;
  site_url: string | null;
  name: string;
  email: string | null;
  role: string;
  status: string;
  facebookKey: string | null;
  facebook_key?: string | null; // 백엔드 호환성을 위한 옵셔널 필드
  created_at: string;
}

export default function AdminCreatorsPage() {
  const { token } = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    site_url: "",
    facebookKey: "",
  });

  useEffect(() => {
    fetchCreators();
  }, [token]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 여러 엔드포인트를 순차적으로 시도
      const endpoints = ["/creators", "/admin/creators"];
      let creatorsData: Creator[] = [];
      let lastError: Error | null = null;
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${CMS_API_BASE}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

          if (response.ok) {
      const data = await response.json();
            // 응답 구조에 따라 데이터 추출
            if (Array.isArray(data)) {
              creatorsData = data;
            } else if (data.success && data.data && data.data.creators) {
              creatorsData = data.data.creators || [];
            } else if (data.creators) {
              creatorsData = data.creators || [];
            } else if (data.data) {
              creatorsData = Array.isArray(data.data) ? data.data : [];
            }
            // facebook_key를 facebookKey로 변환 (백엔드 호환성)
            creatorsData = creatorsData.map((creator: any) => ({
              ...creator,
              facebookKey: creator.facebookKey || creator.facebook_key || null,
            }));
            setCreators(creatorsData);
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
      
      if (creatorsData.length === 0 && lastError) {
        throw lastError;
      }
    } catch (err) {
      console.error("Failed to fetch creators:", err);
      const errorMessage = err instanceof Error 
        ? err.message 
        : "크리에이터 목록을 불러오는데 실패했습니다.";
      setError(errorMessage);
      setCreators([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingCreator(null);
    setFormData({
      name: "",
      email: "",
      site_url: "",
      facebookKey: "",
    });
    setShowForm(true);
  };

  const handleEdit = (creator: Creator) => {
    setEditingCreator(creator);
    setFormData({
      name: creator.name || "",
      email: creator.email || "",
      site_url: creator.site_url || "",
      facebookKey: creator.facebookKey || (creator as any).facebook_key || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCreator) {
        // 수정 - 여러 엔드포인트와 메서드를 순차적으로 시도
        const endpoints = ["/creators", "/admin/creators"];
        const methods = ["PATCH", "PUT"]; // PATCH를 먼저 시도 (일반적으로 PATCH가 더 많이 사용됨)
        let success = false;
        let lastError: Error | null = null;
        
        const payload = {
          name: formData.name,
          site_url: formData.site_url || null,
          facebookKey: formData.facebookKey || null,
        };
        
        for (const endpoint of endpoints) {
          for (const method of methods) {
            try {
              const response = await fetch(`${CMS_API_BASE}${endpoint}/${editingCreator.id}`, {
                method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
                body: JSON.stringify(payload),
              });
              
              if (response.ok) {
                success = true;
                break; // 성공하면 루프 종료
              } else if (response.status === 404) {
                // 404면 다음 메서드/엔드포인트 시도
                continue;
              } else {
                // 404가 아닌 다른 에러면 상세 정보 수집
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                lastError = new Error(errorMessage);
                // 404가 아닌 에러면 다음 메서드 시도
                continue;
              }
            } catch (err) {
              lastError = err as Error;
              // 404가 아닌 다른 에러면 다음 메서드 시도
              if (err instanceof Error && !err.message.includes("404") && !err.message.includes("not found")) {
                continue;
              }
              continue;
            }
          }
          if (success) break; // 성공하면 외부 루프도 종료
        }
        
        if (!success) {
          throw lastError || new Error("크리에이터 수정에 실패했습니다. 모든 엔드포인트를 시도했지만 실패했습니다.");
        }
      } else {
        // 생성
        // site_id 가져오기 (localStorage 우선, 없으면 null)
        const storedSiteId = localStorage.getItem("site_id");
        const siteIdValue = storedSiteId ? parseInt(storedSiteId, 10) : null;
        
        // 여러 엔드포인트를 순차적으로 시도
        const endpoints = ["/creators", "/admin/creators"];
        let success = false;
        let lastError: Error | null = null;
        
        const payload: any = {
          site_url: formData.site_url || null,
          name: formData.name,
          email: formData.email || null,
          facebookKey: formData.facebookKey || null,
        };
        
        // site_id가 있으면 포함
        if (siteIdValue && !isNaN(siteIdValue)) {
          payload.site_id = siteIdValue;
        }
        
        for (const endpoint of endpoints) {
          try {
            const response = await fetch(`${CMS_API_BASE}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
              body: JSON.stringify(payload),
            });
            
            if (response.ok) {
              success = true;
              break; // 성공하면 루프 종료
            } else if (response.status === 404) {
              // 404면 다음 엔드포인트 시도
              continue;
            } else {
              // 404가 아닌 다른 에러면 상세 정보 수집
              const errorData = await response.json().catch(() => ({}));
              const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
              throw new Error(errorMessage);
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
        
        if (!success) {
          throw lastError || new Error("크리에이터 생성에 실패했습니다. 모든 엔드포인트를 시도했지만 실패했습니다.");
        }
      }

      setShowForm(false);
      setEditingCreator(null);
      fetchCreators();
    } catch (err) {
      console.error("Failed to save creator:", err);
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 크리에이터를 삭제하시겠습니까?")) {
      return;
    }

    try {
      const response = await fetch(`${CMS_API_BASE}/admin/creators/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      fetchCreators();
    } catch (err) {
      console.error("Failed to delete creator:", err);
      setError(err instanceof Error ? err.message : "삭제에 실패했습니다.");
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Creators</h2>
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 className="admin-page-title">Creators</h2>
        <button
          onClick={handleCreate}
          style={{
            padding: "8px 16px",
            backgroundColor: "#0052cc",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          + 크리에이터 추가
        </button>
      </div>

      {error && (
        <div style={{ padding: "12px", backgroundColor: "#fee", color: "#c00", borderRadius: "8px", marginBottom: "16px" }}>
          {error}
        </div>
      )}

      {showForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowForm(false)}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "24px",
              borderRadius: "12px",
              maxWidth: "500px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{editingCreator ? "크리에이터 수정" : "크리에이터 추가"}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>
                  이름 <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>

              {!editingCreator && (
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>이메일</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              )}

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>적용 사이트 주소 (예: godcomfortword.com)</label>
                <input
                  type="text"
                  value={formData.site_url}
                  onChange={(e) => setFormData({ ...formData, site_url: e.target.value })}
                  placeholder="godcomfortword.com"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "4px", fontWeight: 500 }}>Facebook Key</label>
                <input
                  type="text"
                  value={formData.facebookKey}
                  onChange={(e) => setFormData({ ...formData, facebookKey: e.target.value })}
                  placeholder="Facebook Access Token 또는 Key"
                  style={{
                    width: "100%",
                    padding: "8px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f5f5f5",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#0052cc",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="admin-card">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>이름</th>
              <th style={{ padding: "12px", textAlign: "left" }}>이메일</th>
              <th style={{ padding: "12px", textAlign: "left" }}>적용 사이트 주소 (예: godcomfortword.com)</th>
              <th style={{ padding: "12px", textAlign: "left" }}>상태</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Facebook Key</th>
              <th style={{ padding: "12px", textAlign: "left" }}>생성일</th>
              <th style={{ padding: "12px", textAlign: "left" }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: "24px", textAlign: "center", color: "#666" }}>
                  크리에이터가 없습니다.
                </td>
              </tr>
            ) : (
              creators.map((creator) => (
                <tr key={creator.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "12px" }}>{creator.name}</td>
                  <td style={{ padding: "12px" }}>{creator.email || "-"}</td>
                  <td style={{ padding: "12px" }}>{creator.site_url || "-"}</td>
                  <td style={{ padding: "12px" }}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: creator.status === "active" ? "#d4edda" : "#f8d7da",
                        color: creator.status === "active" ? "#155724" : "#721c24",
                      }}
                    >
                      {creator.status}
                    </span>
                  </td>
                  <td style={{ padding: "12px" }}>
                    {(creator.facebookKey || (creator as any).facebook_key) ? (
                      <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        {(() => {
                          const key = creator.facebookKey || (creator as any).facebook_key || "";
                          return key.length > 20
                            ? `${key.substring(0, 20)}...`
                            : key;
                        })()}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {formatDateTimeKST(creator.created_at)}
                  </td>
                  <td style={{ padding: "12px" }}>
                    <button
                      onClick={() => handleEdit(creator)}
                      style={{
                        padding: "4px 8px",
                        marginRight: "4px",
                        backgroundColor: "#0052cc",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(creator.id)}
                      style={{
                        padding: "4px 8px",
                        backgroundColor: "#dc3545",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

