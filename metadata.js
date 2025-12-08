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

// Facebook 썸네일 자동 가져오기
export async function fetchFacebookThumbnail(sourceUrl, accessToken = null) {
  // Access Token이 없으면 null 반환
  if (!accessToken) {
    console.warn("⚠️ Facebook Access Token이 없어 썸네일을 가져올 수 없습니다.");
    return null;
  }

  try {
    // Facebook Graph API oEmbed 엔드포인트 사용
    const oembedUrl = `https://graph.facebook.com/v11.0/oembed_video?url=${encodeURIComponent(sourceUrl)}&access_token=${accessToken}`;
    const response = await fetch(oembedUrl, { timeout: 5000 });
    
    if (response.ok) {
      const data = await response.json();
      // oEmbed 응답에서 썸네일 URL 추출
      if (data.thumbnail_url) {
        return data.thumbnail_url;
      }
    } else {
      console.warn(`⚠️ Facebook oEmbed API 호출 실패: ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.warn("⚠️ Facebook 썸네일 가져오기 오류:", err.message);
  }

  return null;
}

// Facebook embed URL 생성
export async function enrichFacebookMetadata(sourceUrl, userTitle = null, userThumbnail = null, accessToken = null) {
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

  // 썸네일이 없고 Access Token이 있으면 자동으로 가져오기 시도
  let thumbnailUrl = userThumbnail;
  if (!thumbnailUrl && accessToken) {
    thumbnailUrl = await fetchFacebookThumbnail(sourceUrl, accessToken);
  }

  return {
    title: userTitle || null,
    thumbnail_url: thumbnailUrl || null,
    embed_url: embedUrl,
  };
}

// 메타정보 자동 보강 (플랫폼별)
export async function enrichMetadata(platform, sourceUrl, userTitle = null, userThumbnail = null, accessToken = null) {
  switch (platform) {
    case "youtube":
      return await enrichYouTubeMetadata(sourceUrl, userTitle);
    case "facebook":
      return await enrichFacebookMetadata(sourceUrl, userTitle, userThumbnail, accessToken);
    default:
      return {
        title: userTitle || null,
        thumbnail_url: userThumbnail || null,
        embed_url: null,
      };
  }
}

