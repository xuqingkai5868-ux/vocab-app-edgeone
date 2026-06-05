// ===== EdgeOne Pages Middleware =====
// 作用：
//   1) CORS 预检（OPTIONS 直接返回 204）
//   2) 简单预过滤 /api/*（除 /api/seed 外的所有接口，要求有 Bearer Token 头）
//
// 注意：
//   - 中间件运行在 V8 Isolate，**拿不到 my_kv**，所以最终 token 验证在每个 API 的 verifyToken() 里完成
//   - seed 端点故意放行（无 token 也可以调用），用于首次初始化
//   - 路由：访问 /api/login 会自动路由到 edge-functions/api/login.js 的 onRequestPost

export function middleware({ request, next }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // CORS 预检请求
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // 放行的诊断/初始化端点（无 token 也能调）
  if (
    path === '/api/login' ||    // 登录（拿 token 前不能要求有 token）
    path === '/api/seed' ||     // 首次初始化；再次 seed 需要 adminConfirmPin
    path === '/api/ping'        // 最小连通性测试
  ) {
    return next();
  }

  // 其他 /api/* 端点粗粒度校验：有 Bearer 头才放行
  // 真正的 token 有效性校验在每个 API 内的 verifyToken() 中完成（因为它要查 my_kv）
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      error: 'unauthorized',
      message: '需要 Authorization: Bearer <token> 头'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return next();
}

export const config = {
  matcher: ['/api/:path*']
};
