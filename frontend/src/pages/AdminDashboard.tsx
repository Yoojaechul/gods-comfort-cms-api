import { useState, useEffect } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import "../styles/admin-common.css";

interface DashboardSummary {
  totalVideos: number;
  totalCreators: number;
  todayVideos: number;
  recentVideos: Array<{
    id: string;
    title: string;
    creatorName: string;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${CMS_API_BASE}/admin/dashboard/summary`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("대시보드 데이터를 불러오는데 실패했습니다.");
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error("Failed to fetch dashboard summary:", err);
        setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSummary();
    }
  }, [token]);

  if (loading) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Dashboard</h2>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <h2 className="admin-page-title">Dashboard</h2>
        <p className="admin-page-note" style={{ color: "red" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h2 className="admin-page-title">Dashboard</h2>

      {/* 요약 카드 */}
      <div className="dashboard-summary" style={{ marginTop: "32px" }}>
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">전체 영상</p>
          <p className="dashboard-summary-value">{summary?.totalVideos || 0}</p>
        </div>
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">활성 크리에이터</p>
          <p className="dashboard-summary-value">{summary?.totalCreators || 0}</p>
        </div>
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">오늘 업로드</p>
          <p className="dashboard-summary-value">{summary?.todayVideos || 0}</p>
        </div>
      </div>

      {/* 최근 업로드된 영상 테이블 */}
      <div className="admin-card" style={{ marginTop: "24px" }}>
        <h2 className="admin-card-title">최근 업로드된 영상</h2>
        {summary?.recentVideos && summary.recentVideos.length > 0 ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>크리에이터</th>
                <th>업로드 날짜</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentVideos.map((video) => (
                <tr key={video.id}>
                  <td>{video.title}</td>
                  <td>{video.creatorName}</td>
                  <td>{new Date(video.createdAt).toLocaleDateString("ko-KR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>최근 업로드된 영상이 없습니다.</p>
        )}
      </div>
    </div>
  );
}












