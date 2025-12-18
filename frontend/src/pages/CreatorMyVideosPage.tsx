import AdminVideosPage from "./AdminVideosPage";

/**
 * 크리에이터용 "My Videos" 페이지
 * AdminVideosPage를 재사용하여 동일한 UI/기능 제공
 * 백엔드에서 토큰 기반으로 본인 영상만 필터링하여 반환
 */
export default function CreatorMyVideosPage() {
  return <AdminVideosPage role="creator" />;
}
















































