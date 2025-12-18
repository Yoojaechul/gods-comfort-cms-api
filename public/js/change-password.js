// API 서버 URL
// 이 페이지는 CMS 서버에서 서빙되므로, 기본은 same-origin으로 호출하여 포트 하드코딩을 피합니다.
const NEST_API_BASE = window.location.origin;

/**
 * 비밀번호 변경 처리
 */
async function handleChangePassword(event) {
  event.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  // UI 상태 변경
  setLoading(true);
  clearMessages();

  // 새 비밀번호 확인
  if (newPassword !== confirmPassword) {
    showError('새 비밀번호와 확인 비밀번호가 일치하지 않습니다.');
    setLoading(false);
    return;
  }

  // 비밀번호 길이 확인
  if (newPassword.length < 8) {
    showError('새 비밀번호는 최소 8자 이상이어야 합니다.');
    setLoading(false);
    return;
  }

  try {
    // 토큰 가져오기 (admin 또는 creator)
    const adminToken = localStorage.getItem('admin_jwt_token');
    const creatorToken = localStorage.getItem('creator_jwt_token');
    const token = adminToken || creatorToken;

    if (!token) {
      showError('로그인이 필요합니다. 로그인 페이지로 이동합니다.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    console.log('비밀번호 변경 시도...');

    // NestJS /auth/change-password API 호출
    const response = await fetch(`${NEST_API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const data = await response.json();

    // 응답 처리
    if (!response.ok) {
      handleChangePasswordError(response.status, data);
      return;
    }

    // 비밀번호 변경 성공
    handleChangePasswordSuccess(data);

  } catch (error) {
    console.error('비밀번호 변경 에러:', error);
    showError('서버 연결에 실패했습니다. NestJS 서버가 실행 중인지 확인하세요.');
  } finally {
    setLoading(false);
  }
}

/**
 * 비밀번호 변경 성공 처리
 */
function handleChangePasswordSuccess(data) {
  console.log('✅ 비밀번호 변경 성공:', data);

  showSuccess('비밀번호가 성공적으로 변경되었습니다. 3초 후 대시보드로 이동합니다.');

  // 3초 후 대시보드로 이동
  setTimeout(() => {
    const adminToken = localStorage.getItem('admin_jwt_token');
    if (adminToken) {
      window.location.href = '/admin/index.html';
    } else {
      window.location.href = '/creator/index.html';
    }
  }, 3000);
}

/**
 * 비밀번호 변경 에러 처리
 */
function handleChangePasswordError(statusCode, data) {
  console.error(`❌ 비밀번호 변경 실패 (${statusCode}):`, data);

  let errorMessage = '비밀번호 변경에 실패했습니다.';

  switch (statusCode) {
    case 400:
      errorMessage = data.message || '현재 비밀번호가 올바르지 않거나 새 비밀번호 형식이 잘못되었습니다.';
      break;
    case 401:
      errorMessage = '인증이 만료되었습니다. 다시 로그인해주세요.';
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      break;
    case 404:
      errorMessage = '사용자를 찾을 수 없습니다.';
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
  const button = document.getElementById('changePasswordButton');
  const buttonText = document.getElementById('buttonText');
  const spinner = document.getElementById('buttonSpinner');
  const currentPasswordInput = document.getElementById('currentPassword');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  if (isLoading) {
    if (button) button.disabled = true;
    if (buttonText) buttonText.style.display = 'none';
    if (spinner) spinner.style.display = 'inline';
    if (currentPasswordInput) currentPasswordInput.disabled = true;
    if (newPasswordInput) newPasswordInput.disabled = true;
    if (confirmPasswordInput) confirmPasswordInput.disabled = true;
  } else {
    if (button) button.disabled = false;
    if (buttonText) buttonText.style.display = 'inline';
    if (spinner) spinner.style.display = 'none';
    if (currentPasswordInput) currentPasswordInput.disabled = false;
    if (newPasswordInput) newPasswordInput.disabled = false;
    if (confirmPasswordInput) confirmPasswordInput.disabled = false;
  }
}

















































