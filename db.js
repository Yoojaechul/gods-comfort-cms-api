import { MongoClient } from "mongodb";
import { randomBytes, scryptSync } from "crypto";

let client;
let db;

// MongoDB 초기화
export async function initDB() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error("❌ MONGODB_URI 환경 변수가 설정되지 않았습니다.");
      throw new Error("MongoDB URI not configured");
    }

    client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db("cms"); // 데이터베이스 이름: cms
    
    console.log("✅ MongoDB connected successfully");
    
    // 인덱스 생성
    await db.collection("users").createIndex({ email: 1 }, { unique: true, sparse: true });
    await db.collection("users").createIndex({ status: 1 });
    await db.collection("videos").createIndex({ site_id: 1 });
    await db.collection("videos").createIndex({ owner_id: 1 });
    await db.collection("videos").createIndex({ visibility: 1 });
    await db.collection("videos").createIndex({ created_at: -1 });
    await db.collection("visits").createIndex({ site_id: 1 });
    await db.collection("visits").createIndex({ created_at: -1 });
    
    console.log("✅ Database indexes created successfully");
  } catch (error) {
    console.error("❌ MongoDB initialization error:", error.message);
    throw error;
  }
}

// MongoDB 인스턴스 가져오기
function getDB() {
  if (!db) {
    throw new Error("MongoDB is not initialized. Call initDB() first.");
  }
  return db;
}

// SQLite-style prepare/get/all/run wrapper for MongoDB
const dbWrapper = {
  prepare: (query) => {
    return {
      get: async (...params) => {
        const db = getDB();
        
        // SELECT * FROM users WHERE email = ? AND status = 'active'
        if (query.includes("FROM users WHERE email")) {
          const email = params[0];
          return await db.collection("users").findOne({ email, status: "active" });
        }
        
        // SELECT * FROM users WHERE id = ?
        if (query.includes("FROM users WHERE id")) {
          const userId = params[0];
          return await db.collection("users").findOne({ id: userId });
        }
        
        // SELECT * FROM sites WHERE id = ?
        if (query.includes("FROM sites WHERE id")) {
          const siteId = params[0];
          return await db.collection("sites").findOne({ id: siteId });
        }
        
        // SELECT * FROM videos WHERE id = ?
        if (query.includes("FROM videos WHERE id")) {
          const videoId = params[0];
          return await db.collection("videos").findOne({ id: videoId });
        }
        
        return null;
      },
      
      all: async (...params) => {
        const db = getDB();
        
        // SELECT * FROM videos WHERE site_id = ? AND owner_id = ?
        if (query.includes("FROM videos") && query.includes("owner_id")) {
          const siteId = params[0];
          const ownerId = params[1];
          return await db.collection("videos")
            .find({ site_id: siteId, owner_id: ownerId })
            .sort({ created_at: -1 })
            .toArray();
        }
        
        // SELECT * FROM videos WHERE site_id = ? AND visibility = 'public'
        if (query.includes("FROM videos") && query.includes("visibility")) {
          const siteId = params[0];
          return await db.collection("videos")
            .find({ site_id: siteId, visibility: "public", status: "active" })
            .sort({ created_at: -1 })
            .limit(100)
            .toArray();
        }
        
        // SELECT * FROM videos WHERE site_id = ?
        if (query.includes("FROM videos")) {
          const siteId = params[0];
          return await db.collection("videos")
            .find({ site_id: siteId })
            .sort({ created_at: -1 })
            .toArray();
        }
        
        // Analytics queries
        if (query.includes("FROM visits") && query.includes("COUNT")) {
          const siteId = params[0];
          const startDate = params[1];
          const endDate = params[2];
          
          if (query.includes("GROUP BY country_code")) {
            const result = await db.collection("visits").aggregate([
              {
                $match: {
                  site_id: siteId,
                  created_at: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                  },
                },
              },
              {
                $group: {
                  _id: "$country_code",
                  country_name: { $first: "$country_name" },
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ]).toArray();
            
            return result.map(r => ({
              country_code: r._id,
              country_name: r.country_name,
              count: r.count,
            }));
          }
          
          if (query.includes("GROUP BY language")) {
            const result = await db.collection("visits").aggregate([
              {
                $match: {
                  site_id: siteId,
                  created_at: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                  },
                },
              },
              {
                $group: {
                  _id: "$language",
                  count: { $sum: 1 },
                },
              },
              { $sort: { count: -1 } },
            ]).toArray();
            
            return result.map(r => ({
              language: r._id,
              count: r.count,
            }));
          }
          
          if (query.includes("GROUP BY date")) {
            const result = await db.collection("visits").aggregate([
              {
                $match: {
                  site_id: siteId,
                  created_at: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate),
                  },
                },
              },
              {
                $group: {
                  _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { _id: -1 } },
              { $limit: 90 },
            ]).toArray();
            
            return result.map(r => ({
              date: r._id,
              count: r.count,
            }));
          }
          
          // Total count
          const count = await db.collection("visits").countDocuments({
            site_id: siteId,
            created_at: {
              $gte: new Date(startDate),
              $lte: new Date(endDate),
            },
          });
          return [{ count }];
        }
        
        return [];
      },
      
      run: async (...params) => {
        const db = getDB();
        
        // INSERT INTO users
        if (query.includes("INSERT INTO users")) {
          const [id, siteId, name, email, passwordHash, role, status, apiKeyHash, apiKeySalt] = params;
          await db.collection("users").insertOne({
            id,
            site_id: siteId || null,
            name,
            email: email || null,
            password_hash: passwordHash || null,
            role,
            status,
            api_key_hash: apiKeyHash,
            api_key_salt: apiKeySalt,
            created_at: new Date(),
          });
          return { changes: 1 };
        }
        
        // INSERT INTO sites
        if (query.includes("INSERT INTO sites")) {
          const [id, name] = params;
          await db.collection("sites").insertOne({
            id,
            name,
            created_at: new Date(),
          });
          return { changes: 1 };
        }
        
        // INSERT INTO videos
        if (query.includes("INSERT INTO videos")) {
          const [id, siteId, ownerId, platform, videoId, sourceUrl, title, thumbnailUrl, embedUrl, language, status, visibility] = params;
          await db.collection("videos").insertOne({
            id,
            site_id: siteId,
            owner_id: ownerId,
            platform,
            video_id: videoId || null,
            source_url: sourceUrl,
            title: title || null,
            thumbnail_url: thumbnailUrl || null,
            embed_url: embedUrl || null,
            language: language || "en",
            status: status || "active",
            visibility: visibility || "public",
            views_count: 0,
            likes_count: 0,
            shares_count: 0,
            created_at: new Date(),
            updated_at: new Date(),
          });
          return { changes: 1 };
        }
        
        // INSERT INTO visits
        if (query.includes("INSERT INTO visits")) {
          const [id, siteId, ipAddress, countryCode, countryName, language, pageUrl, userAgent] = params;
          await db.collection("visits").insertOne({
            id,
            site_id: siteId,
            ip_address: ipAddress,
            country_code: countryCode || null,
            country_name: countryName || null,
            language: language || null,
            page_url: pageUrl || null,
            user_agent: userAgent || null,
            created_at: new Date(),
          });
          return { changes: 1 };
        }
        
        // UPDATE users SET password_hash = ?, api_key_salt = ?, email = ? WHERE email = ?
        if (query.includes("UPDATE users SET password_hash")) {
          const passwordHash = params[0];
          const salt = params[1];
          const newEmail = params[2];
          const oldEmail = params[3];
          
          await db.collection("users").updateOne(
            { email: oldEmail },
            {
              $set: {
                password_hash: passwordHash,
                api_key_salt: salt,
                email: newEmail,
              },
            }
          );
          return { changes: 1 };
        }
        
        // UPDATE videos
        if (query.includes("UPDATE videos SET")) {
          // 개별 업데이트는 별도 함수로 처리
          return { changes: 1 };
        }
        
        // DELETE FROM videos WHERE id = ?
        if (query.includes("DELETE FROM videos WHERE id")) {
          const videoId = params[0];
          await db.collection("videos").deleteOne({ id: videoId });
          return { changes: 1 };
        }
        
        return { changes: 0 };
      },
    };
  },
};

// 비디오 업데이트
export async function updateVideo(videoId, updateData) {
  try {
    const db = getDB();
    await db.collection("videos").updateOne(
      { id: videoId },
      {
        $set: {
          ...updateData,
          updated_at: new Date(),
        },
      }
    );
    return true;
  } catch (error) {
    console.error("Error updating video:", error);
    throw error;
  }
}

// 비디오 stats 업데이트
export async function updateVideoStats(videoId, stats, updatedBy) {
  try {
    const db = getDB();
    await db.collection("videos").updateOne(
      { id: videoId },
      {
        $set: {
          views_count: stats.views_count,
          likes_count: stats.likes_count,
          shares_count: stats.shares_count,
          stats_updated_at: new Date(),
          stats_updated_by: updatedBy,
        },
      }
    );
    return true;
  } catch (error) {
    console.error("Error updating video stats:", error);
    throw error;
  }
}

// 대량 비디오 생성
export async function createVideosBulk(videos) {
  try {
    const db = getDB();
    const docs = videos.map(v => ({
      ...v,
      views_count: v.views_count || 0,
      likes_count: v.likes_count || 0,
      shares_count: v.shares_count || 0,
      created_at: new Date(),
      updated_at: new Date(),
    }));
    const result = await db.collection("videos").insertMany(docs);
    return result.insertedCount;
  } catch (error) {
    console.error("Error creating videos bulk:", error);
    throw error;
  }
}

// 대량 비디오 삭제
export async function deleteVideosBulk(videoIds) {
  try {
    const db = getDB();
    const result = await db.collection("videos").deleteMany({ id: { $in: videoIds } });
    return result.deletedCount;
  } catch (error) {
    console.error("Error deleting videos bulk:", error);
    throw error;
  }
}

// 사용자 업데이트
export async function updateUser(userId, updateData) {
  try {
    const db = getDB();
    await db.collection("users").updateOne(
      { id: userId },
      { $set: updateData }
    );
    return true;
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

// API Key 해싱
export function hashApiKey(apiKey) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(apiKey, salt, 64).toString("hex");
  return { hash, salt };
}

// API Key 검증
export function verifyApiKey(apiKey, hash, salt) {
  try {
    const testHash = scryptSync(apiKey, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

// 랜덤 API Key 생성
export function generateApiKey() {
  return randomBytes(32).toString("hex");
}

// 랜덤 ID 생성
export function generateId() {
  return randomBytes(16).toString("hex");
}

// 비밀번호 해싱 (scrypt 사용)
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

// 비밀번호 검증
export function verifyPassword(password, hash, salt) {
  try {
    const testHash = scryptSync(password, salt, 64).toString("hex");
    return testHash === hash;
  } catch {
    return false;
  }
}

export default dbWrapper;
