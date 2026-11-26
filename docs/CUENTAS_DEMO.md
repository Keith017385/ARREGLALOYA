# Cuentas de demostración

Estas cuentas son ficticias y se crean solo en una base PostgreSQL local. Sus correos usan el dominio reservado `.invalid`; no reciben correo.

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | `cliente.demo@example.invalid` | `DemoCliente2026!` |
| Trabajador | `trabajador.demo@example.invalid` | `DemoTrabajador2026!` |
| Administrador | `admin.demo@example.invalid` | `DemoAdmin2026!` |
| Superadministrador | `superadmin.demo@example.invalid` | `DemoSuper2026!` |

El trabajador demo queda asignado a la zona Centro y a las categorías que existan en la base.

## Crear o restaurar las cuentas

Desde PowerShell, con PostgreSQL local y el esquema base ya instalado, ejecuta en `backend`:

```powershell
$env:DOTENV_CONFIG_PATH = "$env:USERPROFILE\Documents\ChatGPT\SISINFO\herramientas\arreglalo-local\.env.local"
$env:DOTENV_CONFIG_OVERRIDE = "true"
$env:ALLOW_DEMO_SEED = "true"
npm run seed:demo
Remove-Item Env:DOTENV_CONFIG_PATH, Env:DOTENV_CONFIG_OVERRIDE, Env:ALLOW_DEMO_SEED
```

El seed exige `ALLOW_DEMO_SEED=true`, rechaza hosts remotos y solo acepta bases locales llamadas `postgres`, `local`, `demo` o `test`. Al repetirse, actualiza las cuatro cuentas ficticias con estos correos y roles; no borra solicitudes, ofertas ni otros datos.

No uses estas credenciales en producción ni en una base compartida. Para compilar y probar la aplicación, sigue las instrucciones de [README](../README.md).
