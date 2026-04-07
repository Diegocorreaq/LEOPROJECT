const BASE_URL = "/api";

export class AuthError extends Error {
  constructor(message = "No autenticado") {
    super(message);
    this.name = "AuthError";
    this.status = 401;
  }
}

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 500;
    this.details = Array.isArray(options.details) ? options.details : [];
    this.payload = options.payload ?? null;
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
    if (res.status === 401) {
      throw new AuthError(data?.error || "Sesion expirada. Inicia sesion nuevamente.");
    }

    throw new ApiError(data?.error || `Error ${res.status} en la solicitud`, {
      status: res.status,
      details: data?.detalles,
      payload: data,
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
};
