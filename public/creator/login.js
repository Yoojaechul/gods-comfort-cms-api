// NestJS API 서버 주소
const NEST_API_BASE = "http://localhost:8788";

// 페이지 로드 완료 후 초기화
window.addEventListener("load", () => {
  console.log("[login.js] 페이지 로드 완료, 초기화 시작");
  
  // 이미 로그인되어 있으면 바로 대시보드로
  const token = localStorage.getItem("creator_jwt_token");
  if (token) {
    console.log("[login.js] 이미 로그인된 상태, 대시보드로 이동");
    window.location.href = "/creator/index.html";
    return;
  }

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginButton = document.getElementById("loginButton");
  const errorMessage = document.getElementById("errorMessage");

  if (!emailInput || !passwordInput || !loginButton) {
    console.error("[login.js] 필수 요소를 찾을 수 없습니다.");
    return;
  }

  function showError(msg) {
    if (!errorMessage) return;
    errorMessage.textContent = msg;
    errorMessage.style.display = "block";
    console.error("[login.js] 에러:", msg);
  }

  function hideError() {
    if (!errorMessage) return;
    errorMessage.style.display = "none";
  }

  async function handleLogin() {
    console.log("[login.js] 로그인 시도 시작");
    hideError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError("아이디와 비밀번호를 올바르게 입력해주세요.");
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "로그인 중...";

    try {
      console.log("[login.js] API 요청:", `${NEST_API_BASE}/auth/login`);
      const res = await fetch(`${NEST_API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      console.log("[login.js] 응답 상태:", res.status, res.statusText);

      let data;
      try {
        data = await res.json();
        console.log("[login.js] 응답 데이터:", data);
      } catch (parseError) {
        console.error("[login.js] JSON 파싱 오류:", parseError);
        showError("서버 응답을 읽을 수 없습니다.");
        return;
      }

      if (!res.ok) {
        console.error("[login.js] 로그인 실패:", res.status, data);

        // 최초 비밀번호 미설정 계정(403)인 경우
        if (res.status === 403 && data && (data.error === "Password not set" || data.message?.error === "Password not set")) {
          showError("아직 비밀번호가 설정되지 않은 계정입니다. Thunder Client로 setup-password를 먼저 호출해주세요.");
          return;
        }

        showError("아이디와 비밀번호를 올바르게 입력해주세요.");
        return;
      }

      // ---- 로그인 성공 처리 ----
      // NestJS 응답 구조: { token, expiresAt, user }
      const token = data.token;
      const user = data.user;
      const expiresAt = data.expiresAt;

      console.log("[login.js] 로그인 성공, 데이터 추출:", { 
        hasToken: !!token, 
        hasUser: !!user, 
        hasExpiresAt: !!expiresAt 
      });

      // 반드시 다음 3개 값이 localStorage에 저장되도록 보장
      if (!token) {
        console.error("[login.js] 토큰이 응답에 없습니다:", data);
        showError("토큰을 받지 못했습니다. 다시 시도해주세요.");
        return;
      }

      // 1. creator_jwt_token 저장
      localStorage.setItem("creator_jwt_token", token);
      console.log("[login.js] creator_jwt_token 저장 완료");

      // 2. creator_user 저장
      if (user) {
        localStorage.setItem("creator_user", JSON.stringify(user));
        console.log("[login.js] creator_user 저장 완료:", user);
      } else {
        console.warn("[login.js] 사용자 정보가 응답에 없습니다.");
        // 사용자 정보가 없어도 토큰은 저장하고 진행
      }

      // 3. creator_token_expires 저장
      if (expiresAt) {
        localStorage.setItem("creator_token_expires", expiresAt);
        console.log("[login.js] creator_token_expires 저장 완료:", expiresAt);
      } else {
        console.warn("[login.js] 만료 시간이 응답에 없습니다.");
        // 만료 시간이 없어도 토큰은 저장하고 진행
      }

      // 저장 완료 확인
      const savedToken = localStorage.getItem("creator_jwt_token");
      const savedUser = localStorage.getItem("creator_user");
      const savedExpires = localStorage.getItem("creator_token_expires");

      console.log("[login.js] 저장 확인:", {
        token: savedToken ? "저장됨" : "없음",
        user: savedUser ? "저장됨" : "없음",
        expires: savedExpires ? "저장됨" : "없음"
      });

      if (savedToken === token) {
        console.log("[login.js] 모든 저장 완료, 대시보드로 이동");
        // 저장이 완료된 후 이동
        window.location.href = "/creator/index.html";
      } else {
        console.error("[login.js] 토큰 저장 검증 실패");
        showError("토큰 저장에 실패했습니다. 다시 시도해주세요.");
      }
    } catch (err) {
      console.error("[login.js] 로그인 요청 오류:", err);
      showError("서버와 통신 중 문제가 발생했습니다: " + err.message);
    } finally {
      loginButton.disabled = false;
      loginButton.textContent = "로그인";
    }
  }

  loginButton.addEventListener("click", handleLogin);
  passwordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  });

  console.log("[login.js] 초기화 완료");
});

