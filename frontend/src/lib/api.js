function resolveApiBaseUrl() {
  const rawBaseUrl = typeof import.meta.env.VITE_API_BASE_URL === "string"
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : "";

  // Vacio = mismo origen (/api). Absoluto = backend externo (por ejemplo https://api.midominio.com/api).
  const baseUrl = rawBaseUrl || "/api";
  const normalizedBaseUrl = /^[a-z][a-z\d+\-.]*:\/\//i.test(baseUrl)
    ? baseUrl
    : baseUrl.startsWith("/")
      ? baseUrl
      : `/${baseUrl}`;

  return normalizedBaseUrl === "/" ? "" : normalizedBaseUrl.replace(/\/+$/, "");
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

const API_BASE_URL = resolveApiBaseUrl();

export class AuthError extends Error {
  constructor(message = "No autenticado", options = {}) {
    super(message);
    this.name = "AuthError";
    this.status = 401;
    this.requestId = options.requestId ?? null;
    this.payload = options.payload ?? null;
  }
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 500;
    this.details = Array.isArray(options.details) ? options.details : [];
    this.payload = options.payload ?? null;
    this.requestId = options.requestId ?? null;
  }
}

async function request(path, options = {}) {
  const res = await fetch(buildApiUrl(path), {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  let data;
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = {};
  }

  if (!res.ok) {
    const requestId = res.headers.get("x-request-id") || data?.requestId || null;

    if (res.status === 401) {
      throw new AuthError(data?.error || "Sesion expirada. Inicia sesion nuevamente.", {
        requestId,
        payload: data,
      });
    }

    throw new ApiError(data?.error || `Error ${res.status} en la solicitud`, {
      status: res.status,
      details: data?.detalles,
      payload: data,
      requestId,
    });
  }

  return data;
}

export const api = {
  get: (path) => request(path),

  /**
   * GET paginado: devuelve { items, total, page, pageSize }.
   * Lee los headers X-Total-Count, X-Page, X-Page-Size que el backend
   * escribe con applyPaginationHeaders.
   */
  getList: async (path) => {
    const res = await fetch(buildApiUrl(path), {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });

    let data = {};
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      data = await res.json();
    }

    if (!res.ok) {
      const requestId = res.headers.get("x-request-id") || data?.requestId || null;
      if (res.status === 401) {
        throw new AuthError(data?.error || "Sesion expirada. Inicia sesion nuevamente.", {
          requestId,
          payload: data,
        });
      }
      throw new ApiError(data?.error || `Error ${res.status} en la solicitud`, {
        status: res.status,
        details: data?.detalles,
        payload: data,
        requestId,
      });
    }

    return {
      items: Array.isArray(data) ? data : [],
      total: Number(res.headers.get("x-total-count") ?? 0),
      page: Number(res.headers.get("x-page") ?? 1),
      pageSize: Number(res.headers.get("x-page-size") ?? (Array.isArray(data) ? data.length : 0)),
    };
  },

  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),

  // Para subida de archivos (multipart/form-data).
  // NO pasar Content-Type — el browser lo setea con el boundary correcto.
  upload: async (path, formData) => {
    const res = await fetch(buildApiUrl(path), {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    let data = {};
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      data = await res.json();
    }
    if (!res.ok) {
      const requestId = res.headers.get("x-request-id") || data?.requestId || null;
      if (res.status === 401) {
        throw new AuthError(data?.error || "Sesion expirada.", {
          requestId,
          payload: data,
        });
      }
      throw new ApiError(data?.error || `Error ${res.status}`, {
        status: res.status,
        details: data?.detalles,
        payload: data,
        requestId,
      });
    }
    return data;
  },
};
