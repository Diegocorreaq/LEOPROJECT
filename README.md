# Grupo Leo - Sistema Operativo de Transporte

Repositorio del sistema interno para operaciones de transporte, guias, facturacion, servicios y liquidaciones.

## Stack actual

- Frontend: React + Vite
- Backend: Express
- ORM: Prisma
- Base de datos: PostgreSQL

## Seguridad implementada

- Validacion centralizada de variables de entorno al arranque
- Helmet
- CORS restringido por origen exacto
- Cookie HttpOnly para sesion
- `SameSite` y `Secure` configurables por entorno
- Rate limiting global y rate limiting de login
- Validacion Zod en endpoints de negocio
- Logger estructurado con Pino
- Request ID por request (`X-Request-Id`)
- Auditoria persistente en tabla `AuditLog`
- Validacion CSRF por `Origin/Referer` para requests mutantes autenticados por cookie

## Variables de entorno

### Backend (`backend/.env`)

Parte desde [`backend/.env.example`](./backend/.env.example).

Variables principales:

- `PORT=3000`
- `NODE_ENV=development`
- `DATABASE_URL=...`
- `JWT_SECRET=...`
- `ALLOWED_ORIGINS=http://localhost:5173`
- `COOKIE_SECURE=false`
- `COOKIE_SAME_SITE=lax`
- `SERVE_FRONTEND=false`

Notas:

- `ALLOWED_ORIGINS` acepta multiples origenes separados por coma.
- `COOKIE_SAME_SITE=none` requiere `COOKIE_SECURE=true`.
- `SERVE_FRONTEND=true` hace que Express sirva `frontend/dist` cuando el build existe.

### Frontend (`frontend/.env`)

Parte desde [`frontend/.env.example`](./frontend/.env.example).

- `VITE_API_BASE_URL=`

Notas:

- Vacio: usa `/api` en el mismo origen.
- Absoluto: usa un backend externo, por ejemplo `https://api.tudominio.com/api`.
- No pongas secretos en variables `VITE_*`.

## Escenarios de ejecucion

### 1. Desarrollo local

Backend:

```powershell
cd backend
npm install
copy .env.example .env
```

Completa al menos:

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS=http://localhost:5173`
- `COOKIE_SECURE=false`
- `COOKIE_SAME_SITE=lax`
- `SERVE_FRONTEND=false`

Luego:

```powershell
npm run prisma:generate
npx prisma migrate deploy
npm run seed
npm run dev
```

Frontend:

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

En este modo:

- Vite corre en `http://localhost:5173`
- Express corre en `http://localhost:3000`
- El proxy de Vite reenvia `/api` hacia `localhost:3000`
- `VITE_API_BASE_URL` debe quedar vacio

### 2. Produccion same-origin

Camino recomendado para hosting barato.

Backend:

- `SERVE_FRONTEND=true`
- `COOKIE_SECURE=true` si el sitio corre por HTTPS
- `COOKIE_SAME_SITE=lax` en la mayoria de despliegues same-origin
- `ALLOWED_ORIGINS=https://tu-dominio.com`

Frontend:

- `VITE_API_BASE_URL=` vacio

Build y arranque:

```powershell
npm --prefix frontend install
npm --prefix frontend run build
npm --prefix backend install
npm --prefix backend run start
```

En este modo:

- Express sirve `frontend/dist`
- El frontend consume `/api`
- Recargar rutas profundas del SPA devuelve `index.html`
- No dependes de CORS para el flujo principal

### 3. Produccion split-origin

Usalo solo cuando realmente necesites frontend y backend en dominios distintos.

Backend:

- `ALLOWED_ORIGINS=https://tu-frontend.com`
- `COOKIE_SAME_SITE=none`
- `COOKIE_SECURE=true`
- `SERVE_FRONTEND=false`

Frontend:

- `VITE_API_BASE_URL=https://tu-backend.com/api`

Comandos tipicos:

```powershell
npm --prefix frontend install
$env:VITE_API_BASE_URL="https://tu-backend.com/api"
npm --prefix frontend run build
npm --prefix backend install
npm --prefix backend run start
```

En este modo:

- El frontend se despliega por separado
- El backend acepta solo los origenes configurados en `ALLOWED_ORIGINS`
- La autenticacion por cookie sigue funcionando con `credentials: "include"` si el navegador esta en contexto cross-site valido

## Seed inicial

El seed crea un usuario `ADMIN` real.

- Email por defecto: `admin@grupoleo.com`
- Password: tomado de `SEED_ADMIN_PASSWORD`
- Minimo recomendado y exigido por seed: 12 caracteres

## Politica de acceso resumida

- `OPERACIONES`: lectura y operacion diaria
- `ADMIN`: eliminaciones, desactivaciones sensibles y desvinculaciones manuales delicadas

## Politica de borrado actual

- `Cliente`: desactivacion logica (`activo = false`)
- `Vehiculo`: desactivacion logica (`estado = INACTIVO`)
- `Conductor`: desactivacion logica (`activo = false`)
- `Guia`, `Liquidacion`, `Factura`: borrado fisico solo para `ADMIN`, con auditoria persistente

## Empaquetado seguro

No empaquetes el proyecto manualmente arrastrando carpetas completas del workspace.

Usa un artefacto limpio con:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-clean.ps1
```

Ese flujo excluye:

- `.git/`
- `.claude/`
- `node_modules/`
- `.env`
- artefactos temporales o de build

## Archivos que nunca deben viajar en una entrega

- `backend/.env`
- cualquier `.env.local`
- `.git/`
- `.claude/`
- `node_modules/`
- `dist/`
- configuraciones personales del editor

## Referencias

- [SECURITY.md](./SECURITY.md)
- [backend/.env.example](./backend/.env.example)
- [frontend/.env.example](./frontend/.env.example)
