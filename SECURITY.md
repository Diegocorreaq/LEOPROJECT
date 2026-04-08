# Seguridad - Grupo Leo

Ultima actualizacion: 2026-04-07

## Controles implementados de verdad

### Autenticacion y sesion

- JWT firmado
- Cookie HttpOnly para transporte de sesion
- `SameSite=Lax` en desarrollo y `Strict` en produccion
- `authMiddleware` revalida usuario activo desde la base de datos en cada request
- El frontend no guarda tokens en `localStorage`

### Hardening HTTP

- `Helmet`
- CORS restringido a `ALLOWED_ORIGINS`
- limite de payload JSON (`1mb`)
- rate limiting global
- rate limiting especifico para login

### CSRF

La proteccion CSRF ya no es solo implicita por `SameSite`.

Ahora el backend valida `Origin` o `Referer` en todos los metodos mutantes autenticados por cookie:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`

Si el origen no coincide con `ALLOWED_ORIGINS`, la solicitud se bloquea con `403`.

### Validacion de entrada

- Validacion Zod para `body`
- Validacion formal adicional de `params`
- Validacion formal adicional de `query`
- validacion de UUIDs, fechas, banderas booleanas, enums y paginacion en rutas principales

### RBAC

Roles actuales:

- `OPERACIONES`
- `ADMIN`

Politica aplicada en esta fase:

- operaciones normales: `OPERACIONES` o `ADMIN`
- acciones destructivas: `ADMIN`
- overrides sensibles como ciertas desvinculaciones o reasignaciones: `ADMIN`

### Auditoria y trazabilidad

- `X-Request-Id` en cada request
- logs estructurados con Pino incluyendo `requestId`
- tabla persistente `AuditLog`
- auditoria de:
  - creacion
  - actualizacion
  - cambio de estado
  - vinculacion
  - desvinculacion
  - desactivacion
  - eliminacion

### Integridad de datos

- transacciones Prisma en operaciones multi-paso
- `PUT /api/servicios/:id` ya no lee campos criticos directo desde `req.body` sin validar
- el flujo legacy de `clientes` dentro de servicios pasa por validacion formal y reglas compartidas con el modulo de clientes

### Politica de destruccion de datos

- `Cliente`: soft delete (`activo = false`)
- `Vehiculo`: desactivacion (`estado = INACTIVO`)
- `Conductor`: desactivacion (`activo = false`)
- `GuiaRemision`, `Liquidacion`, `Factura`: hard delete solo para `ADMIN`, con auditoria

## Riesgos mitigados en esta ronda

- bypass de validacion en `PUT /api/servicios/:id`
- lectura directa de `req.query` y `req.params` sin validacion en rutas principales
- operaciones destructivas disponibles para usuarios de operaciones
- falta de correlacion por request en logs
- falta de auditoria persistente
- proteccion CSRF explicita ausente
- seed inicial inconsistente con rol documentado
- entrega insegura del repositorio sin guia de artefacto limpio

## Riesgos que siguen pendientes

- no existe aun autorizacion por objeto basada en ownership real
- no hay modulo de administracion de usuarios ni gestion formal de roles desde UI
- no hay MFA para cuentas `ADMIN`
- varios listados frontend aun consumen una sola pagina y no exponen navegacion paginada visual
- no hay firma ni retencion avanzada de auditoria

## Como probar localmente

### 1. Backend

```powershell
cd backend
npm install
copy .env.example .env
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

### 3. Pruebas recomendadas

#### Validacion de CSRF

1. Inicia sesion normalmente desde el frontend.
2. Intenta un `POST` autenticado hacia el backend con un `Origin` distinto al configurado.
3. Debe responder `403` con mensaje de bloqueo CSRF.

#### Validacion de RBAC

1. Usa un usuario `OPERACIONES`.
2. Intenta eliminar una guia, factura o liquidacion.
3. Debe responder `403`.
4. Repite con un usuario `ADMIN`.
5. Debe permitir la operacion.

#### Validacion de servicios update

1. Envía `PUT /api/servicios/:id` con `clienteIds`, `clientes`, `tipoContrato`, `vehiculoId` o `conductorId`.
2. Verifica que valores invalidos sean rechazados por Zod.
3. Verifica que clientes legacy invalidos no se creen.

## Despliegue y empaquetado

No subas ni empaquetes:

- `.env`
- `.claude/`
- `.git/`
- `node_modules/`
- `dist/`
- archivos personales del editor

Usa el flujo documentado en `README.md` y el script `scripts/package-clean.ps1`.
