# Instrucciones persistentes del proyecto

## Objetivo
Esta aplicación debe construirse como una app web empresarial interna.
Toda propuesta de código debe priorizar seguridad, mantenibilidad, trazabilidad y preparación para despliegue corporativo.

## Reglas obligatorias
- Aplicar criterios OWASP Top 10 y OWASP API Security por defecto.
- No asumir que autenticación implica autorización.
- Toda ruta sensible debe validar:
  - autenticación,
  - autorización por rol,
  - autorización por objeto/recurso cuando corresponda.
- No introducir secretos hardcodeados.
- No guardar tokens en localStorage si existe alternativa segura viable.
- Preferir cookies HttpOnly + Secure + SameSite para auth web.
- Validar todas las entradas del backend con esquemas formales.
- En operaciones multi-paso que afecten varias entidades, usar transacciones.
- Minimizar datos expuestos por la API.
- No devolver errores internos sensibles al cliente.
- Registrar eventos críticos con logging estructurado.
- Mantener `.env.example` limpio y nunca versionar secretos reales.
- Endurecer Express para producción: Helmet, CORS restringido, límites de payload, manejo centralizado de errores.

## Backend
- Usar middlewares reutilizables para auth, RBAC, validación y manejo de errores.
- Revisar especialmente endpoints GET by id, PUT, PATCH, DELETE y listados masivos.
- No permitir acceso por ID sin validar permisos sobre el recurso.

## Frontend
- No almacenar datos sensibles innecesarios.
- Mantener consistencia con el mecanismo de auth del backend.
- No introducir sinks inseguros de XSS.

## Base de datos / Prisma
- Usar transacciones cuando una operación toque múltiples relaciones.
- No crear seeds con credenciales fijas o inseguras.

## Forma de trabajo
Antes de modificar:
1. identificar riesgos relevantes,
2. explicar brevemente qué se va a cambiar,
3. implementar cambios concretos,
4. listar archivos modificados,
5. resumir riesgos mitigados y pendientes.