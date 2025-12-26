import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";

export default function FacebookKeysPage() {
  const { token, user } = useAuth();
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    facebookAccessToken: "",
    pageId: "",
    userId: "",
    appId: "",
    note: "",
  });

  const isAdmin = user?.role === "admin";
  const basePath = isAdmin ? "/admin" : "/creator";

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      const endpoint = isAdmin ? "/admin/facebook-keys" : "/my/facebook-keys";
      const response = await fetch(`${CMS_API_BASE}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error("Failed to fetch keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = isAdmin
        ? `/admin/facebook-keys/${user?.id}`
        : "/my/facebook-keys";
      const method = isAdmin ? "PUT" : "PUT";

      await fetch(`${CMS_API_BASE}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      setShowForm(false);
      setFormData({
        facebookAccessToken: "",
        pageId: "",
        userId: "",
        appId: "",
        note: "",
      });
      fetchKeys();
    } catch (error) {
      console.error("Failed to save key:", error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout role={isAdmin ? "admin" : "creator"}>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={isAdmin ? "admin" : "creator"}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Facebook Key 관리</h1>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {keys.length > 0 ? "수정" : "등록"}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Facebook Key {keys.length > 0 ? "수정" : "등록"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token *
                </label>
                <input
                  type="text"
                  value={formData.facebookAccessToken}
                  onChange={(e) =>
                    setFormData({ ...formData, facebookAccessToken: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page ID
                </label>
                <input
                  type="text"
                  value={formData.pageId}
                  onChange={(e) => setFormData({ ...formData, pageId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  User ID
                </label>
                <input
                  type="text"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  App ID
                </label>
                <input
                  type="text"
                  value={formData.appId}
                  onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메모
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  저장
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  취소
                </button>
              </div>
            </form>
          </div>
        )}

        {keys.length === 0 && !showForm ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <p className="text-gray-500 mb-4">등록된 Facebook Key가 없습니다.</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              등록하기
            </button>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key.id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Access Token</p>
                  <p className="text-sm font-mono text-gray-900">{key.facebook_access_token}</p>
                </div>
                {key.page_id && (
                  <div>
                    <p className="text-sm text-gray-500">Page ID</p>
                    <p className="text-sm text-gray-900">{key.page_id}</p>
                  </div>
                )}
                {key.user_id && (
                  <div>
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="text-sm text-gray-900">{key.user_id}</p>
                  </div>
                )}
                {key.app_id && (
                  <div>
                    <p className="text-sm text-gray-500">App ID</p>
                    <p className="text-sm text-gray-900">{key.app_id}</p>
                  </div>
                )}
                {key.note && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">메모</p>
                    <p className="text-sm text-gray-900">{key.note}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}

































































































