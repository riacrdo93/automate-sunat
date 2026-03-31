# Control De Cuentas Seller

## Regla Operativa

Cada cuenta de Falabella se prueba aislada con:

- un puerto propio
- un `DATA_DIR` propio
- una sesión de seller separada
- sus logs y screenshots separados

Formato base:

| Cuenta | Seller | Puerto | DATA_DIR | Estado | Ultimo resultado |
| --- | --- | --- | --- | --- | --- |
| Beauty Home | beautyhomeperu1@gmail.com | 3030 | `./data` | Activa | Base histórica actual |
| Dolphin | dolphinperu1@gmail.com | 3041 | `./data-dolphin` | Activa | Perfil propio con login en `/user/auth/login` |
| Cuenta 3 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Cuenta 4 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Cuenta 5 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Cuenta 6 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
| Cuenta 7 | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |

## Estado Actual

### 1. Beauty Home

- Seller: `beautyhomeperu1@gmail.com`
- Puerto: `3030`
- Data dir: `./data`
- Estado actual: en espera
- Resumen:
  - la instancia está levantada y sin ejecución en curso
  - mantiene el historial principal de pruebas
  - en `/api/state` tiene 25 ventas registradas en esa base

### 2. Dolphin

- Seller: `dolphinperu1@gmail.com`
- Puerto: `3041`
- Data dir: `./data-dolphin`
- Profile: `./config/dolphin-profile.json`
- SUNAT: login SOL por `RUC`
- Estado actual: en espera
- Prueba más reciente:
  - se separó en perfil propio para no tocar `Beauty Home`
  - el login de seller para esta cuenta debe iniciar desde `https://sellercenter.falabella.com/user/auth/login`
  - el login de SUNAT para esta cuenta debe iniciar por pestaña `RUC`
  - se relanzó desde sesión limpia en `./data-dolphin`
  - la contraseña anterior estaba incompleta
  - con la contraseña corregida sí inició sesión y sí cargó la bandeja de `Documentos tributarios`
  - ya está leyendo órdenes reales de esta cuenta, por ejemplo `3230016047`, `3229991728`, `3229988096`
  - resultado actual: cuenta validada y en procesamiento real con su instancia aislada

## Regla Para Las Siguientes Pruebas

Antes de probar una cuenta nueva:

1. asignar un puerto nuevo
2. asignar un `DATA_DIR` nuevo
3. registrar la cuenta en esta tabla
4. correr la prueba solo en su instancia
5. anotar el resultado antes de pasar a la siguiente
