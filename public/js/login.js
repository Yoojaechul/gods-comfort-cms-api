// NestJS API 서버 URL (환경에 따라 변경)
const NEST_API_BASE = 'http://localhost:8788';

// 페이지 로드 시 이미 로그인되어 있는지 확인
window.addEventListener('DOMContentLoaded', () => {
  // Admin 또는 Creator 토큰 확인
  const adminToken = localStorage.getItem('admin_jwt_token');
  const creatorToken = localStorage.getItem('creator_jwt_token');
  
  if (adminToken) {
    // Admin 토큰이 있으면 대시보드로 이동
    console.log('이미 Admin으로 로그인되어 있습니다. 대시보드로 이동합니다...');
    window.location.href = '/admin/index.html';
    return;
  }
  
  if (creatorToken) {
    // Creator 토큰이 있으면 대시보드로 이동
    console.log('이미 Creator로 로그인되어 있습니다. 대시보드로 이동합니다...');
    window.location.href = '/creator/index.html';
    return;
  }

  // API 서버 URL 표시
  const apiServerEl = document.getElementById('apiServer');
  if (apiServerEl) {
    apiServerEl.textContent = NEST_API_BASE.replace('http://', '');
  }
});

/**
 * 로그인 처리
 */
async function handleLogin(event) {
  event.preventDefault();

  const identifier = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  // UI 상태 변경
  setLoading(true);
  clearMessages();

  try {
    console.log(`로그인 시도: ${identifier}`);

    // identifier가 이메일 형식인지 확인
    const isEmail = identifier.includes('@');
    
    // NestJS /auth/login API 호출
    // username 또는 email 중 하나만 보냄
    const response = await fetch(`${NEST_API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        isEmail
          ? { email: identifier, password }
          : { username: identifier, password }
      ),
    });

    const data = await response.json();

    // 응답 처리
    if (!response.ok) {
      handleLoginError(response.status, data);
      return;
    }

    // 로그인 성공
    handleLoginSuccess(data);

  } catch (error) {
    console.error('로그인 에러:', error);
    showError('서버 연결에 실패했습니다. NestJS 서버가 실행 중인지 확인하세요.');
  } finally {
    setLoading(false);
  }
}

/**
 * 로그인 성공 처리
 */
function handleLoginSuccess(data) {
  console.log('✅ 로그인 성공:', data);

  const { token, user, expiresAt } = data;

  if (!user || !user.role) {
    showError('사용자 정보를 가져올 수 없습니다.');
    return;
  }

  // role에 따라 다른 localStorage 키 사용
  const tokenKey = user.role === 'admin' ? 'admin_jwt_token' : 'creator_jwt_token';
  const userKey = user.role === 'admin' ? 'admin_user' : 'creator_user';
  const expiresKey = user.role === 'admin' ? 'admin_token_expires' : 'creator_token_expires';

  // JWT 토큰 저장
  localStorage.setItem(tokenKey, token);
  
  // 사용자 정보 저장
  localStorage.setItem(userKey, JSON.stringify(user));
  
  // 토큰 만료 시간 저장
  if (expiresAt) {
    localStorage.setItem(expiresKey, expiresAt);
  }

  // 성공 메시지 표시
  showSuccess(`환영합니다, ${user.name}님! (${user.role === 'admin' ? '관리자' : '크리에이터'})`);

  // 1초 후 role에 따라 적절한 페이지로 이동
  setTimeout(() => {
    if (user.role === 'admin') {
      window.location.href = '/admin/index.html';
    } else if (user.role === 'creator') {
      window.location.href = '/creator/index.html';
    } else {
      showError('알 수 없는 사용자 역할입니다.');
    }
  }, 1000);
}

/**
 * 로그인 에러 처리
 */
function handleLoginError(statusCode, data) {
  console.error(`❌ 로그인 실패 (${statusCode}):`, data);

  let errorMessage = '로그인에 실패했습니다.';

  switch (statusCode) {
    case 400:
      errorMessage = '사용자명과 비밀번호를 올바르게 입력해주세요.';
      break;
    case 401:
      errorMessage = '사용자명 또는 비밀번호가 올바르지 않습니다.';
      break;
    case 403:
      // 비밀번호 미설정 (최초 로그인 필요)
      if (data.message && typeof data.message === 'object' && data.message.requires_setup) {
        errorMessage = '비밀번호가 설정되지 않았습니다. 최초 비밀번호 설정이 필요합니다.';
        console.log('비밀번호 설정 필요:', data.message);
      } else {
        errorMessage = '접근 권한이 없습니다.';
      }
      break;
    case 404:
      errorMessage = '존재하지 않는 계정입니다.';
      break;
    case 500:
      errorMessage = '서버 내부 오류가 발생했습니다. 관리자에게 문의하세요.';
      break;
    default:
      errorMessage = data.message || '알 수 없는 오류가 발생했습니다.';
  }

  showError(errorMessage);
}

/**
 * 에러 메시지 표시
 */
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  }
}

/**
 * 성공 메시지 표시
 */
function showSuccess(message) {
  const successDiv = document.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
  }
}

/**
 * 메시지 초기화
 */
function clearMessages() {
  const errorDiv = document.getElementById('errorMessage');
  const successDiv = document.getElementById('successMessage');
  if (errorDiv) errorDiv.style.display = 'none';
  if (successDiv) successDiv.style.display = 'none';
}

/**
 * 로딩 상태 설정
 */
function setLoading(isLoading) {
  const button = document.getElementById('loginButton');
  const buttonText = document.getElementById('buttonText');
  const spinner = document.getElementById('buttonSpinner');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');

  if (isLoading) {
    if (button) button.disabled = true;
    if (buttonText) buttonText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';
    if (emailInput) emailInput.disabled = true;
    if (passwordInput) passwordInput.disabled = true;
  } else {
    if (button) button.disabled = false;
    if (buttonText) buttonText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    if (emailInput) emailInput.disabled = false;
    if (passwordInput) passwordInput.disabled = false;
  }
}



