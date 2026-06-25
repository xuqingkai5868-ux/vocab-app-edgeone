// 家长密码验证 API 客户端
// 调用 /api/verify-admin-pin 验证密码，避免密码暴露在前端

export async function verifyAdminPin(pin: string): Promise<boolean> {
  try {
    const response = await fetch('/api/verify-admin-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data.ok === true;
  } catch {
    return false;
  }
}
