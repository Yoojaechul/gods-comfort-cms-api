import db, { hashPassword } from "./db.js";

// Admin 계정 설정
async function setupAdmin() {
  console.log("🔧 Admin 계정 설정 시작...");

  // 관리자 정보
  const adminEmail = "admin@gods.com";
  const adminPassword = "admin123"; // 프로덕션에서는 강력한 비밀번호 사용

  // 기존 Admin 확인
  const admin = db.prepare("SELECT * FROM users WHERE role = ?").get("admin");

  if (!admin) {
    console.log("❌ Admin 계정이 없습니다. 서버를 먼저 실행해주세요.");
    return;
  }

  console.log(`✅ 기존 Admin 계정: ${admin.name}`);

  // 비밀번호 해싱
  const { hash, salt } = hashPassword(adminPassword);

  // Admin 계정 업데이트 (이메일과 비밀번호 설정)
  db.prepare(
    "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ? WHERE id = ?"
  ).run(adminEmail, hash, salt, admin.id);

  console.log(`✅ Admin 이메일 설정: ${adminEmail}`);
  console.log(`✅ Admin 비밀번호 설정: ${adminPassword}`);
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Admin 계정 설정 완료!");
  console.log("=".repeat(60));
  console.log("\n📝 로그인 정보:");
  console.log(`   이메일: ${adminEmail}`);
  console.log(`   비밀번호: ${adminPassword}`);
  console.log("\n🌐 관리자 페이지:");
  console.log(`   CMS Admin UI: http://localhost:8787/admin`);
  console.log(`   Next.js Admin: http://localhost:3000/admin/dashboard`);
  console.log("\n⚠️  프로덕션 환경에서는 반드시 강력한 비밀번호를 사용하세요!");
  console.log("=".repeat(60));
}

setupAdmin().catch((err) => {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
});



// Admin 계정 설정
async function setupAdmin() {
  console.log("🔧 Admin 계정 설정 시작...");

  // 관리자 정보
  const adminEmail = "admin@gods.com";
  const adminPassword = "admin123"; // 프로덕션에서는 강력한 비밀번호 사용

  // 기존 Admin 확인
  const admin = db.prepare("SELECT * FROM users WHERE role = ?").get("admin");

  if (!admin) {
    console.log("❌ Admin 계정이 없습니다. 서버를 먼저 실행해주세요.");
    return;
  }

  console.log(`✅ 기존 Admin 계정: ${admin.name}`);

  // 비밀번호 해싱
  const { hash, salt } = hashPassword(adminPassword);

  // Admin 계정 업데이트 (이메일과 비밀번호 설정)
  db.prepare(
    "UPDATE users SET email = ?, password_hash = ?, api_key_salt = ? WHERE id = ?"
  ).run(adminEmail, hash, salt, admin.id);

  console.log(`✅ Admin 이메일 설정: ${adminEmail}`);
  console.log(`✅ Admin 비밀번호 설정: ${adminPassword}`);
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Admin 계정 설정 완료!");
  console.log("=".repeat(60));
  console.log("\n📝 로그인 정보:");
  console.log(`   이메일: ${adminEmail}`);
  console.log(`   비밀번호: ${adminPassword}`);
  console.log("\n🌐 관리자 페이지:");
  console.log(`   CMS Admin UI: http://localhost:8787/admin`);
  console.log(`   Next.js Admin: http://localhost:3000/admin/dashboard`);
  console.log("\n⚠️  프로덕션 환경에서는 반드시 강력한 비밀번호를 사용하세요!");
  console.log("=".repeat(60));
}

setupAdmin().catch((err) => {
  console.error("❌ 오류 발생:", err);
  process.exit(1);
});


