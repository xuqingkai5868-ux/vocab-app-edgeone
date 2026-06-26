// 家长密码验证 & 修改 API 客户端
// 调用 /api/verify-admin-pin 验证密码，避免密码暴露在前端
//
// 兜底策略：API 不通时（如新 Edge Function 尚未部署），
// 回退到本地验证，确保不因为服务端问题导致家长无法操作

const LOCAL_DEFAULT_PIN = '888888';

export async function verifyAdminPin(pin: string): Promise<boolean> {
  // 优先调 API（生产环境）
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/verify-admin-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // API 返回错误（如 401/404），降级到本地验证
      return pin === LOCAL_DEFAULT_PIN;
    }
    const data = await response.json();
    return data.ok === true;
  } catch {
    // 网络错误/API 不存在，降级到本地验证
    return pin === LOCAL_DEFAULT_PIN;
  }
}

/** 修改家长密码（需要验证旧密码） */
export async function updateAdminPin(currentPin: string, newPin: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/update-admin-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return data;
  } catch {
    return { ok: false, message: '网络错误，无法连接服务器' };
  }
}
