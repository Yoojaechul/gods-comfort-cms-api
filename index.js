import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const FB_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
const FB_VER = process.env.FACEBOOK_GRAPH_API_VERSION || "v20.0";

// 기본 CORS 및 설정
app.use(cors());
app.use(express.json());

// 헬스 체크
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 내가 관리하는 페이지 목록 조회
app.get("/pages", async (req, res) => {
  try {
    const url = `https://graph.facebook.com/${FB_VER}/me/accounts?access_token=${FB_TOKEN}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    res.json(data);
  } catch (err) {
    console.error("/pages error:", err);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// 페이지의 모든 동영상 목록
app.get("/videos", async (req, res) => {
  const pageId = req.query.page_id;
  if (!pageId) {
    return res.status(400).json({ error: "page_id query parameter is required" });
  }

  const fields = "id,title,description,created_time,permalink_url,thumbnails{uri}";

  try {
    const url = `https://graph.facebook.com/${FB_VER}/${pageId}/videos?fields=${fields}&access_token=${FB_TOKEN}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    res.json(data);
  } catch (err) {
    console.error("/videos error:", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// 특정 동영상의 상세 메타데이터 조회
app.get("/video/:id", async (req, res) => {
  const videoId = req.params.id;

  const fields =
    "id,title,description,created_time,permalink_url,length,thumbnails{uri}";

  try {
    const url = `https://graph.facebook.com/${FB_VER}/${videoId}?fields=${fields}&access_token=${FB_TOKEN}`;
    const fbRes = await fetch(url);
    const data = await fbRes.json();
    res.json(data);
  } catch (err) {
    console.error(`/video/${videoId} error:`, err);
    res.status(500).json({ error: "Failed to fetch video details" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Facebook CMS API server running on http://localhost:${PORT}`);
});

































































































