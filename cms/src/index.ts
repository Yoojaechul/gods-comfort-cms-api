import cors from "cors";
import type { Request, Response } from "express";
import { onRequest } from "firebase-functions/v2/https";

// ✅ TS 설정 호환을 위해 require 방식 사용
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require("express");

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

function extractYouTubeId(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // ID만 들어온 경우(11자)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  }

  // youtube.com
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    const parts = url.pathname.split("/").filter(Boolean);

    // /shorts/<id>
    const shortsIdx = parts.indexOf("shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) {
      const id = parts[shortsIdx + 1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    // /embed/<id>
    const embedIdx = parts.indexOf("embed");
    if (embedIdx >= 0 && parts[embedIdx + 1]) {
      const id = parts[embedIdx + 1];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
  }

  return null;
}

app.get("/metadata/youtube", async (req: Request, res: Response) => {
  try {
    const inputUrl = String(req.query.url || "");
    const videoId = extractYouTubeId(inputUrl);

    if (!videoId) {
      return res.status(400).json({
        error: "Invalid YouTube URL or ID",
        input: inputUrl,
      });
    }

    // ✅ Firebase secret (functions 옵션 secrets로 연결되어야 들어옵니다)
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing YOUTUBE_API_KEY",
        message:
          "Firebase secret is not attached. Ensure onRequest({ secrets:['YOUTUBE_API_KEY'] }) and redeploy.",
      });
    }

    const apiUrl =
      "https://www.googleapis.com/youtube/v3/videos" +
      `?part=snippet&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "YouTube Data API failed",
        status: response.status,
        body: text,
      });
    }

    const json = JSON.parse(text) as any;
    const item = json?.items?.[0];
    const snippet = item?.snippet;

    if (!snippet) {
      return res.status(404).json({
        error: "Video not found or no snippet",
        videoId,
        raw: json,
      });
    }

    const thumbs = snippet.thumbnails || {};
    const thumbUrl =
      thumbs.maxres?.url ||
      thumbs.standard?.url ||
      thumbs.high?.url ||
      thumbs.medium?.url ||
      thumbs.default?.url ||
      "";

    return res.json({
      provider: "youtube-data-api",
      videoId,
      title: snippet.title || "",
      authorName: snippet.channelTitle || "",
      thumbnailUrl: thumbUrl,
      raw: json,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: "Internal server error",
      message: err?.message || String(err),
    });
  }
});

// ✅ export 이름은 기존대로 api 유지 (현재 배포 URL도 /api 로 잡혀있음)
export const api = onRequest(
  {
    region: "asia-northeast3",
    secrets: ["YOUTUBE_API_KEY"],
  },
  app
);
