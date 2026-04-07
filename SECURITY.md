# Seguridad — Grupo Leo Sistema de Gestión

Documento técnico de seguridad para el sistema interno de transporte de carga.
Última actualización: 2026-04-07

---

## Resumen del modelo de seguridad

| Área | Mecanismo |
|---|---|
| Autenticación | JWT firmado + cookie HttpOnly |
| Autorización | RBAC por rol (`OPERACIONES`, `ADMIN`) |
| Transporte de credenciales | Cookie HttpOnly/Secure/SameSite |
| Headers HTTP | Helmet (HSTS, CSP, XFO, etc.) |
| Protección brute force | express-rate-limit (10 intentos / 15 min en login) |
| Validación de entrada | Zod en todos los endpoints críticos |
| Integridad de operaciones | Transacciones Prisma en operaciones multi-paso |
| Logging | Pino (JSON estructurado), redacta campos sensibles |
| Secretos | Solo en .env (jamás en código fuente) |

---

## Autenticación y sesión

### Flujo de login
1. `POST /api/auth/login` con `{ email, password }`
2. El backend valida credenciales y activo del usuario
3. Emite JWT firmado (8h) enviado como **cookie HttpOnly**
4. El frontend **nunca toca el token** — viaja automáticamente en las cookies
5. Cada request protegido verifica la cookie + consulta BD para estado activo del usuario

### Cookie de autenticación
```
Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800
```

| Atributo | Valor | Motivo |
|---|---|---|
| `HttpOnly` | true | JS no puede leer la cookie → protege contra XSS |
| `Secure` | true en producción | Solo HTTPS |
| `SameSite` | Strict (prod) / Lax (dev) | Mitiga CSRF |
| `Max-Age` | 28800 (8h) | Igual que expiración JWT |

### Endpoints de auth
- `POST /api/auth/login` — emite cookie
- `POST /api/auth/logout` — borra cookie en servidor
- `GET /api/auth/me` — restaura sesión al recargar la app

### Logout
El logout invoca `POST /api/auth/logout` que ejecuta `res.clearCookie()`. El frontend
nunca almacena el token, por lo que borrarlo del servidor es suficiente.

---

## RBAC (Control de Acceso Basado en Roles)

### Roles definidos
| Rol | Descripción | Permisos |
|---|---|---|
| `OPERACIONES` | Usuario estándar de operaciones | Lectura y escritura en servicios, clientes, vehículos, conductores |
| `ADMIN` | Administrador | Todos los permisos. Reservado para operaciones destructivas futuras |

### Implementación
El middleware `requireRole(...roles)` en `middleware/rbac.js` verifica el rol del usuario
tras la autenticación. Se aplica a nivel de router en todas las rutas.

El rol se lee de la BD en cada request (no del JWT), lo que permite desactivar/cambiar
el rol de un usuario en tiempo real.

### Supuesto actual
Todos los usuarios existentes tienen rol `OPERACIONES`. Para crear un usuario ADMIN,
actualizar directamente en BD hasta que se implemente una interfaz de gestión de usuarios.

---

## Gestión de variables de entorno

### Variables obligatorias
| Variable | Descripción | Requisito |
|---|---|---|
| `DATABASE_URL` | URL de conexión PostgreSQL | Obligatoria |
| `JWT_SECRET` | Secreto para firmar JWT | Obligatoria, mín. 32 chars |
| `PORT` | Puerto del servidor | Opcional (default: 3000) |
| `NODE_ENV` | Entorno de ejecución | Recomendada |
| `ALLOWED_ORIGINS` | Orígenes CORS permitidos | Recomendada en producción |
| `COOKIE_SECURE` | Forzar cookies solo en HTTPS | `true` en producción |
| `LOG_LEVEL` | Nivel de logging | Opcional (default: info) |

### Generar JWT_SECRET seguro
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### NUNCA versionar el .env
El archivo `.env` está en `.gitignore`. Si ya fue commiteado históricamente:
```bash
git rm --cached backend/.env
git commit -m "remove .env from tracking"
# Cambiar el JWT_SECRET y la contraseña de BD inmediatamente
```

---

## Rate Limiting

| Endpoint | Límite | Ventana |
|---|---|---|
| `POST /api/auth/login` | 10 intentos fallidos | 15 minutos por IP |
| Todos los demás | 500 requests | 15 minutos por IP |

El limiter de login usa `skipSuccessfulRequests: true` — los logins exitosos no consumen el límite.

---

## Validación de entrada

Todos los endpoints que reciben datos utilizan schemas Zod definidos en `src/validators/`.
Los errores de validación devuelven HTTP 400 con un array de `detalles`:
```json
{
  "error": "Datos de entrada inválidos",
  "detalles": [
    { "campo": "ruc", "mensaje": "El RUC debe tener exactamente 11 dígitos numéricos" }
  ]
}
```

---

## Transacciones de base de datos

Las operaciones multi-paso están envueltas en `prisma.$transaction()`:

| Operación | Entidades involucradas |
|---|---|
| `POST /api/servicios` (SUBCONTRATADO) | PropietarioSubcontratado + Vehiculo + Conductor + Servicio + ServicioCliente |
| `PUT /api/servicios/:id` (con clientes) | ServicioCliente (delete + create) + Servicio |

---

## Logging y auditoría

El logger (`src/lib/logger.js`) usa Pino con los siguientes eventos registrados:

| Evento | Nivel | Campos |
|---|---|---|
| Login exitoso | info | userId, email, rol, ip |
| Login fallido | warn | email, motivo, ip |
| Acceso denegado (RBAC) | warn | userId, rolActual, rolesRequeridos, path |
| Servicio creado | info | servicioId, usuarioId, clienteIds |
| Estado servicio actualizado | info | servicioId, estadoNuevo, usuarioId |
| Cliente creado/actualizado | info | clienteId, usuarioId |
| Usuario inactivo intentando acceder | warn | userId, email |

**Los campos sensibles (`password`, `passwordHash`, `token`, `authorization`, `cookie`)
son redactados automáticamente con `[REDACTED]`.**

---

## Configuración de producción — Checklist

Antes de desplegar en producción:

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` con al menos 64 caracteres aleatorios (generado en este entorno)
- [ ] `COOKIE_SECURE=true` (requiere HTTPS)
- [ ] `ALLOWED_ORIGINS` con el dominio real de la app
- [ ] PostgreSQL en servidor separado con usuario con mínimos privilegios
- [ ] Configurar reverse proxy (nginx/caddy) con HTTPS
- [ ] El backend NO debe estar expuesto directamente a internet — detrás de reverse proxy
- [ ] Revisar `backend/prisma/schema.prisma` — considerar row-level security en PostgreSQL
- [ ] Agregar monitoreo de logs (loki, datadog, cloudwatch, etc.)
- [ ] Establecer política de rotación de JWT_SECRET con renovación de sesiones

---

## Riesgos pendientes de mitigación

| Riesgo | Severidad | Descripción | Mitigación recomendada |
|---|---|---|---|
| IDOR en servicios | MEDIO | Cualquier OPERACIONES puede editar cualquier servicio | Agregar campo `creadoPorId` en Servicio y verificar ownership o requerir ADMIN para editar ajenos |
| Sin CSRF token explícito | BAJO | Mitigado por SameSite=Strict en producción | Agregar CSRF token si se expone a internet |
| Sin refresh token | MEDIO | Al expirar (8h) el usuario debe volver a loguearse | Implementar refresh token con rotación |
| Sin 2FA | ALTO (para prod) | Un usuario comprometido tiene acceso total | Agregar TOTP (Google Authenticator) para usuarios ADMIN al menos |
| Historial git con .env | ALTO si aplicable | Si el .env fue commiteado, los secrets están en el historial | Rotar secrets + usar `git filter-repo` para limpiar historial |
| Sin SSL/TLS en base de datos | MEDIO | Conexión a PostgreSQL sin cifrado | Configurar `sslmode=require` en DATABASE_URL para prod |

---

## Instrucciones para testing local post-cambios

```bash
# 1. Instalar dependencias backend
cd backend && npm install

# 2. Generar JWT_SECRET e ingresar en .env (si es primera vez)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Correr seed con contraseña segura
SEED_ADMIN_PASSWORD="MiContraseña123!" npm run seed

# 4. Iniciar backend
npm run dev

# 5. Iniciar frontend (en otra terminal)
cd ../frontend && npm run dev

# 6. Probar login en http://localhost:5173/login
# 7. Verificar en DevTools > Application > Cookies: debe aparecer la cookie "token" con HttpOnly=true
# 8. Verificar que NO hay token en localStorage
```
