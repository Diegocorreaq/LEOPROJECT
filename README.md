# Grupo Leo - Sistema Operativo de Transporte

Repositorio del sistema interno para operaciones de transporte, guias, facturacion, servicios y liquidaciones.

## Stack actual

- Frontend: React + Vite
- Backend: Express
- ORM: Prisma
- Base de datos: PostgreSQL

## Seguridad ya implementada

- Validacion centralizada de variables de entorno al arranque
- Helmet
- CORS restringido por entorno
- Cookie HttpOnly para sesion
- Rate limiting global y rate limiting de login
- Validacion Zod en endpoints de negocio
- Logger estructurado con Pino
- Request ID por request (`X-Request-Id`)
- Auditoria persistente en tabla `AuditLog`
- Validacion CSRF explicita por `Origin/Referer` para requests mutantes autenticados por cookie
- Acciones destructivas y overrides sensibles restringidos a `ADMIN`

## Puesta en marcha local

### 1. Backend

```powershell
cd backend
npm install
copy .env.example .env
```

Completa `backend/.env` con:

- `DATABASE_URL`
- `JWT_SECRET`
- `ALLOWED_ORIGINS`
- `COOKIE_SECURE`
- `SEED_ADMIN_PASSWORD`

Luego ejecuta:

```powershell
npm run prisma:generate
npx prisma migrate deploy
npm run seed
npm run dev
```

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Seed inicial

El seed crea un usuario **ADMIN** real.

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

Usa artefacto limpio con:

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
