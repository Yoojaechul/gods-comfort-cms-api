import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { getApiBase } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [period, setPeriod] = useState("week");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `${getApiBase()}/admin/analytics?period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  if (loading) {
    return (
      <DashboardLayout role="admin">
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">방문자 통계</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="week">주간</option>
            <option value="month">월간</option>
            <option value="quarter">분기별</option>
            <option value="half">반기별</option>
            <option value="year">연간</option>
          </select>
        </div>

        {analytics && (
          <>
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-500 mb-1">총 방문자 수</p>
              <p className="text-3xl font-bold text-gray-900">
                {analytics.total_visitors?.toLocaleString() || 0}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 언어별 통계 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  언어별 방문자 비율
                </h2>
                {analytics.by_language && analytics.by_language.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.by_language}
                        dataKey="visitors"
                        nameKey="language"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ language, percentage }) =>
                          `${language}: ${percentage}%`
                        }
                      >
                        {analytics.by_language.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">데이터가 없습니다.</p>
                )}
              </div>

              {/* 국가별 통계 */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  국가별 방문자 비율
                </h2>
                {analytics.by_country && analytics.by_country.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analytics.by_country}
                        dataKey="visitors"
                        nameKey="country"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ country, percentage }) => `${country}: ${percentage}%`}
                      >
                        {analytics.by_country.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-center py-8">데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

































































































