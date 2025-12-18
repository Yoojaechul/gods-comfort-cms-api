export default function CreatorDashboard() {
  // 더미 데이터 (실제 API 연동은 추후 구현)
  const stats = {
    myVideos: 42,
    totalViews: 125000,
    uploadsThisWeek: 3,
  };

  const recentVideos = [
    { id: 1, title: "내 영상 1", views: 1250, uploadDate: "2024-01-15" },
    { id: 2, title: "내 영상 2", views: 890, uploadDate: "2024-01-14" },
    { id: 3, title: "내 영상 3", views: 2100, uploadDate: "2024-01-13" },
  ];

  return (
    <div>
      {/* 요약 카드 */}
      <div className="dashboard-summary">
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">내 영상 개수</p>
          <p className="dashboard-summary-value">{stats.myVideos}</p>
        </div>
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">총 조회수</p>
          <p className="dashboard-summary-value">{stats.totalViews.toLocaleString()}</p>
        </div>
        <div className="dashboard-summary-card">
          <p className="dashboard-summary-label">이번 주 업로드</p>
          <p className="dashboard-summary-value">{stats.uploadsThisWeek}</p>
        </div>
      </div>

      {/* 내 최근 영상 테이블 */}
      <div className="dashboard-card">
        <h2 className="dashboard-card-title">내 최근 영상</h2>
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>제목</th>
              <th>조회수</th>
              <th>업로드 날짜</th>
            </tr>
          </thead>
          <tbody>
            {recentVideos.map((video) => (
              <tr key={video.id}>
                <td>{video.title}</td>
                <td>{video.views.toLocaleString()}</td>
                <td>{video.uploadDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}























































































