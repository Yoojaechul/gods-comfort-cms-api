// ==================== DB 초기화/스키마 보장 ====================

// Render(새 인스턴스)에서는 cms.db가 비어 있을 수 있으므로,
// "테이블 없어서 부팅 실패"를 절대 못 하게 서버에서 1차 방어 스키마를 보장합니다.
function ensureSchema() {
  // ⚠️ 아래 스키마는 현재 server.js에서 참조하는 핵심 테이블 최소 집합입니다.
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      domain TEXT,
      name TEXT NOT NULL,
      homepage_url TEXT,
      api_base TEXT,
      facebook_key TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      password_hash TEXT,
      api_key_hash TEXT,
      api_key_salt TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS user_provider_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      key_name TEXT NOT NULL,
      key_value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(user_id, provider, key_name),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      video_id TEXT,
      source_url TEXT NOT NULL,
      title TEXT,
      thumbnail_url TEXT,
      embed_url TEXT,
      language TEXT DEFAULT 'en',
      status TEXT DEFAULT 'active',
      visibility TEXT DEFAULT 'public',
      views_count INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      shares_count INTEGER DEFAULT 0,
      management_id INTEGER,
      batch_id TEXT,
      batch_order INTEGER,
      batch_created_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT,
      stats_updated_at TEXT,
      stats_updated_by TEXT,
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL,
      ip_address TEXT,
      country_code TEXT,
      country_name TEXT,
      language TEXT,
      page_url TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stats_adjustments (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      old_views INTEGER,
      new_views INTEGER,
      old_likes INTEGER,
      new_likes INTEGER,
      old_shares INTEGER,
      new_shares INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_like_clients (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(video_id, client_id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_site_id ON users(site_id);

    CREATE INDEX IF NOT EXISTS idx_videos_site_id ON videos(site_id);
    CREATE INDEX IF NOT EXISTS idx_videos_owner_id ON videos(owner_id);
    CREATE INDEX IF NOT EXISTS idx_videos_visibility ON videos(visibility);
    CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at);
    CREATE INDEX IF NOT EXISTS idx_videos_management_id ON videos(management_id);
    CREATE INDEX IF NOT EXISTS idx_videos_batch_id ON videos(batch_id);
    CREATE INDEX IF NOT EXISTS idx_videos_batch_created_at ON videos(batch_created_at);

    CREATE INDEX IF NOT EXISTS idx_visits_site_id ON visits(site_id);
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);

    CREATE INDEX IF NOT EXISTS idx_video_like_clients_video_id ON video_like_clients(video_id);
    CREATE INDEX IF NOT EXISTS idx_video_like_clients_client_id ON video_like_clients(client_id);
  `);
}

function ensureDefaultSiteRow() {
  const defaultSiteId = "gods";
  const exists = db.prepare("SELECT id FROM sites WHERE id = ?").get(defaultSiteId);
  if (!exists) {
    db.prepare(
      "INSERT INTO sites (id, domain, name, homepage_url, api_base, facebook_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
    ).run(
      defaultSiteId,
      "godcomfortword.com",
      "God's Comfort Word",
      "https://www.godcomfortword.com",
      LOCAL_BASE_URL,
      null
    );
    console.log("✅ 기본 사이트(gods) 생성 완료");
  }
}

function safeAdminBootstrap() {
  // 운영에서는 자동 생성 안 함(보안)
  if (!isDevelopment) return;

  const existingAdmin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
  if (existingAdmin) return;

  const adminId = generateId();
  const adminApiKey = generateApiKey();
  const { hash, salt } = hashApiKey(adminApiKey);

  db.prepare(
    "INSERT INTO users (id, site_id, name, role, status, api_key_hash, api_key_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
  ).run(adminId, "gods", "Admin", "admin", "active", hash, salt);

  console.log("=".repeat(60));
  console.log("✅ Admin 자동 생성 완료! (개발 환경)");
  console.log("🔑 Admin API Key:", adminApiKey);
  console.log("⚠️  위 키는 1회 출력이므로 안전하게 보관하세요!");
  console.log("=".repeat(60));
}

// DB 초기화: initDB가 sync든 async든 await 해도 안전합니다.
await initDB();

// initDB 내부가 불완전하거나 Render에서 빈 DB여도, 서버에서 스키마를 반드시 보장
ensureSchema();

// FK 때문에 sites/users 순서 중요: 기본 사이트 먼저 보장
ensureDefaultSiteRow();

// 개발에서만 admin 자동 생성
safeAdminBootstrap();
