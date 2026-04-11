import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await api.post("/auth/login", { email, password });
      // El token viaja en cookie HttpOnly — solo usamos los datos del usuario
      login(data.usuario);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Panel izquierdo - Branding (solo visible en desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] bg-slate-900 relative overflow-hidden">
        {/* Patrón de fondo sutil */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />
        
        {/* Gradiente decorativo */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo y marca */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 shadow-lg shadow-amber-500/25">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Grupo Leo S.A.C.</h1>
              <p className="text-sm text-slate-400">Transporte de Carga</p>
            </div>
          </div>

          {/* Contenido central */}
          <div className="max-w-md">
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Sistema de Gestión de Operaciones
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed">
              Administra servicios, guías de remisión, liquidaciones y facturación de forma centralizada y eficiente.
            </p>
            
            {/* Stats decorativos */}
            <div className="mt-10 grid grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">100%</p>
                <p className="text-sm text-slate-500">Digital</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">24/7</p>
                <p className="text-sm text-slate-500">Disponible</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-white">Seguro</p>
                <p className="text-sm text-slate-500">Protegido</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-sm text-slate-600">
            © {new Date().getFullYear()} Grupo Leo S.A.C. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Panel derecho - Formulario */}
      <div className="flex w-full lg:w-1/2 xl:w-[45%] items-center justify-center bg-slate-50 px-6 py-12">
        {/* Background pattern */}
        <div className="absolute inset-0 lg:hidden -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]" />
        
        <div className="w-full max-w-[400px]">
          {/* Logo móvil */}
          <div className="mb-10 flex flex-col items-center gap-4 lg:hidden">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 shadow-lg">
              <Package className="h-7 w-7 text-amber-400" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900">Grupo Leo S.A.C.</h1>
              <p className="text-sm text-slate-500">Transporte de Carga</p>
            </div>
          </div>

          {/* Header del formulario */}
          <div className="mb-8 lg:mb-10">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Iniciar sesión
            </h2>
            <p className="mt-2 text-slate-500">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Campo Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-700">
                Correo electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  className="h-12 pl-10 text-base bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                />
              </div>
            </div>

            {/* Campo Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-12 pl-10 text-base bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400"
                />
              </div>
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Botón submit */}
            <Button 
              type="submit" 
              className="w-full h-12 text-base font-medium bg-slate-900 hover:bg-slate-800 transition-colors" 
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Ingresando..." : "Ingresar al sistema"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-400">
            Sistema de Gestión Interno — Grupo Leo S.A.C.
          </p>
        </div>
      </div>
    </div>
  );
}
