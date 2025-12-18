import { useState } from "react";
import { CMS_API_BASE } from "../config";
import { useAuth } from "../contexts/AuthContext";
import { getBatchUploadApiEndpoint } from "../lib/videoApi";

interface BatchUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  isAdmin: boolean;
}

export default function BatchUploadModal({
  onClose,
  onSuccess,
  token,
  isAdmin,
}: BatchUploadModalProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState([
    {
      videoType: "youtube" as "youtube" | "facebook",
      title: "",
      description: "",
      language: "ko",
      youtubeId: "",
      facebookUrl: "",
    },
  ]);
  const [results, setResults] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addRow = () => {
    if (rows.length >= 20) return;
    setRows([
      ...rows,
      {
        videoType: "youtube",
        title: "",
        description: "",
        language: "ko",
        youtubeId: "",
        facebookUrl: "",
      },
    ]);
  };

  const removeRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: string, value: any) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setResults([]);

    // videoType을 소문자로 정규화하여 백엔드 요구사항에 맞춤
    // 백엔드에서 요구하는 값: "youtube", "facebook", "file" (소문자만)
    const videosToAdd = rows
      .filter((row) => row.title && (row.youtubeId || row.facebookUrl))
      .map((row) => {
        const normalizedVideoType = (row.videoType || "youtube").toLowerCase();
        const videoType = normalizedVideoType === "youtube" || normalizedVideoType === "facebook" || normalizedVideoType === "file"
          ? normalizedVideoType
          : "youtube"; // 기본값은 youtube
        
        return {
          videoType: videoType, // 정규화된 소문자 값
          title: row.title,
          description: row.description,
          language: row.language,
          youtubeId: videoType === "youtube" ? row.youtubeId : undefined,
          facebookUrl: videoType === "facebook" ? row.facebookUrl : undefined,
        };
      });
    
    console.log("배치 업로드 payload:", videosToAdd);
    console.log("배치 업로드 payload (videoType 확인):", videosToAdd.map(v => ({ videoType: v.videoType })));

    try {
      // role에 따라 API 엔드포인트 결정
      if (!user?.role) {
        throw new Error("사용자 역할 정보를 찾을 수 없습니다. 다시 로그인해주세요.");
      }
      const userRole = user.role as "admin" | "creator";
      const apiPath = getBatchUploadApiEndpoint(userRole);
      const url = `${CMS_API_BASE}${apiPath}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videos: videosToAdd }),
      });

      const data = await response.json();
      setResults(data.results || []);
      
      if (data.created > 0) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (error) {
      console.error("Failed to upload videos:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">대량 등록 (최대 20개)</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    플랫폼
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    제목 *
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    설명
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    언어
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    YouTube ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    Facebook URL
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    결과
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                    삭제
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td className="px-3 py-2">
                      <select
                        value={row.videoType}
                        onChange={(e) =>
                          updateRow(index, "videoType", e.target.value)
                        }
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="youtube">YouTube</option>
                        <option value="facebook">Facebook</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.title}
                        onChange={(e) => updateRow(index, "title", e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                        placeholder="제목"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(index, "description", e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                        placeholder="설명"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={row.language}
                        onChange={(e) => updateRow(index, "language", e.target.value)}
                        className="text-sm border border-gray-300 rounded px-2 py-1 w-20"
                        placeholder="ko"
                      />
                    </td>
                    <td className="px-3 py-2">
                      {row.videoType === "youtube" ? (
                        <input
                          type="text"
                          value={row.youtubeId}
                          onChange={(e) => updateRow(index, "youtubeId", e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                          placeholder="YouTube ID"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.videoType === "facebook" ? (
                        <input
                          type="text"
                          value={row.facebookUrl}
                          onChange={(e) => updateRow(index, "facebookUrl", e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                          placeholder="Facebook URL"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {results[index]?.success ? (
                        <span className="text-green-600 text-xs">✓ 등록 완료</span>
                      ) : results[index]?.error ? (
                        <span className="text-red-600 text-xs">
                          ✗ {results[index].error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => removeRow(index)}
                        className="text-red-600 hover:text-red-700 text-xs"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={addRow}
              disabled={rows.length >= 20}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              행 추가 ({rows.length}/20)
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || rows.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}























































































