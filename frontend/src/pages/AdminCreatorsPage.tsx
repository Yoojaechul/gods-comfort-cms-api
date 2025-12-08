import { useEffect, useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin-common.css";

interface Creator {
  id: string;
  site_url: string | null;
  name: string;
  email: string | null;
  role: string;
  status: string;
  facebook_key: string | null;
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
    facebook_key: "",
  });

  useEffect(() => {
    fetchCreators();
  }, [token]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CMS_API_BASE}/admin/creators`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("크리에이터 목록을 불러오는데 실패했습니다.");
      }

      const data = await response.json();
      if (data.success && data.data && data.data.creators) {
        setCreators(data.data.creators || []);
      } else {
        setCreators([]);
      }
    } catch (err) {
      console.error("Failed to fetch creators:", err);
      setError(err instanceof Error ? err.message : "크리에이터 목록을 불러오는데 실패했습니다.");
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
      facebook_key: "",
    });
    setShowForm(true);
  };

  const handleEdit = (creator: Creator) => {
    setEditingCreator(creator);
    setFormData({
      name: creator.name || "",
      email: creator.email || "",
      site_url: creator.site_url || "",
      facebook_key: creator.facebook_key || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCreator) {
        // 수정
        const response = await fetch(`${CMS_API_BASE}/admin/creators/${editingCreator.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: formData.name,
            site_url: formData.site_url || null,
            facebook_key: formData.facebook_key || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "크리에이터 수정에 실패했습니다.");
        }
      } else {
        // 생성
        const response = await fetch(`${CMS_API_BASE}/admin/creators`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            site_url: formData.site_url || null,
            name: formData.name,
            email: formData.email || null,
            facebook_key: formData.facebook_key || null,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "크리에이터 생성에 실패했습니다.");
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
        const errorData = await response.json();
        throw new Error(errorData.message || "크리에이터 삭제에 실패했습니다.");
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
                  value={formData.facebook_key}
                  onChange={(e) => setFormData({ ...formData, facebook_key: e.target.value })}
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
                    {creator.facebook_key ? (
                      <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                        {creator.facebook_key.length > 20
                          ? `${creator.facebook_key.substring(0, 20)}...`
                          : creator.facebook_key}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {new Date(creator.created_at).toLocaleDateString("ko-KR")}
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

