/**
 * AuthContext.jsx — Gestión de sesión del usuario
 *
 * Cambios de seguridad:
 *  - Token y datos de usuario ya NO se guardan en localStorage
 *  - La sesión se basa en una cookie HttpOnly gestionada por el backend
 *  - Al montar la app, se llama a GET /api/auth/me para restaurar la sesión
 *    (si la cookie sigue válida el usuario queda autenticado sin exponer el token)
 *  - login() solo recibe userData (el token viaja en la cookie, nunca al JS)
 *  - logout() llama a POST /api/auth/logout para que el backend borre la cookie
 */

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, AuthError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Al montar: verificar si hay sesión activa vía cookie
  useEffect(() => {
    api
      .get("/auth/me")
      .then((data) => setUser(data.usuario))
      .catch((err) => {
        // AuthError (401) es el estado normal cuando no hay sesión — no es un error
        if (!(err instanceof AuthError)) {
          console.error("Error al verificar sesión:", err.message);
        }
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  /** Llamar después de un login exitoso. El token ya está en la cookie. */
  function login(userData) {
    setUser(userData);
  }

  /** Cerrar sesión: borra la cookie en el backend y limpia estado local */
  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Si el backend falla, cerramos sesión en el cliente de todas formas
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
