import fetch from "node-fetch";

// YouTube videoId 추출
export function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\s?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// YouTube 메타정보 자동 생성
export async function enrichYouTubeMetadata(sourceUrl, userTitle = null) {
  const videoId = extractYouTubeVideoId(sourceUrl);

  if (!videoId) {
    return {
      title: userTitle || null,
      thumbnail_url: null,
      embed_url: null,
    };
  }

  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // 사용자가 title을 입력한 경우 우선 사용
  if (userTitle) {
    return {
      title: userTitle,
      thumbnail_url: thumbnailUrl,
      embed_url: embedUrl,
    };
  }

  // YouTube oEmbed로 title 가져오기 시도
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      sourceUrl
    )}&format=json`;
    const response = await fetch(oembedUrl, { timeout: 5000 });
    if (response.ok) {
      const data = await response.json();
      return {
        title: data.title || null,
        thumbnail_url: thumbnailUrl,
        embed_url: embedUrl,
      };
    }
  } catch (err) {
    console.warn("YouTube oEmbed fetch failed:", err.message);
  }

  return {
    title: null,
    thumbnail_url: thumbnailUrl,
    embed_url: embedUrl,
  };
}

// Facebook embed URL 생성
export function enrichFacebookMetadata(sourceUrl, userTitle = null, userThumbnail = null) {
  // /share/ URL은 embed 플러그인과 호환되지 않음
  if (sourceUrl.includes("/share/v/") || sourceUrl.includes("/share/r/")) {
    console.warn("⚠️ Facebook /share/ URL은 embed가 제한적입니다. 원본 URL(/watch/ 또는 /videos/)을 사용하세요.");
    // 그래도 시도는 해봄
  }

  // Facebook 플러그인 URL 생성
  // video로 판단 (일반적으로 /videos/ 경로 포함)
  let embedUrl;
  if (sourceUrl.includes("/videos/") || sourceUrl.includes("/watch")) {
    embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
      sourceUrl
    )}&show_text=false&width=560`;
  } else {
    // post로 판단
    embedUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
      sourceUrl
    )}&show_text=true&width=560`;
  }

  return {
    title: userTitle || null,
    thumbnail_url: userThumbnail || null,
    embed_url: embedUrl,
  };
}

// 메타정보 자동 보강 (플랫폼별)
export async function enrichMetadata(platform, sourceUrl, userTitle = null, userThumbnail = null) {
  switch (platform) {
    case "youtube":
      return await enrichYouTubeMetadata(sourceUrl, userTitle);
    case "facebook":
      return enrichFacebookMetadata(sourceUrl, userTitle, userThumbnail);
    default:
      return {
        title: userTitle || null,
        thumbnail_url: userThumbnail || null,
        embed_url: null,
      };
  }
}

