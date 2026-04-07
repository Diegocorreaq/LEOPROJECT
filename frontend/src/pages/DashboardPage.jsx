import { useAuth } from "@/contexts/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-500">
        Bienvenido, <span className="font-medium text-slate-700">{user?.nombre}</span>
      </p>
    </div>
  );
}
