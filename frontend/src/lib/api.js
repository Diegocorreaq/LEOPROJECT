const BASE_URL = "/api";

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
  const res = await fetch(`${BASE_URL}${path}`, {
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
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: "DELETE" }),

  // Para subida de archivos (multipart/form-data).
  // NO pasar Content-Type — el browser lo setea con el boundary correcto.
  upload: async (path, formData) => {
    const res = await fetch(`${BASE_URL}${path}`, {
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
