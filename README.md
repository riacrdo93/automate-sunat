# Automatización Seller a SUNAT

Automatización local por navegador que:

- extrae un sitio seller para detectar ventas nuevas
- convierte cada venta nueva en un borrador de factura
- abre SUNAT en un navegador visible
- se pausa para tu revisión antes del envío final
- muestra el estado en vivo en un panel en [http://localhost:3030](http://localhost:3030)

## Inicio rápido

```bash
npm install
npm run pw:install
cp .env.example .env
npm start
```

Abre [http://localhost:3030](http://localhost:3030) y haz clic en `Iniciar ejecución manual`.

## Integración con el sitio real

1. Parte desde [`config/custom-profile.json`](/Users/ricardo/Documents/automate-sunat/config/custom-profile.json) o usa [`config/custom-profile.example.json`](/Users/ricardo/Documents/automate-sunat/config/custom-profile.example.json) como base.
2. Reemplaza las URLs y selectores de SUNAT por los reales cuando vayas a activar esa parte.
3. Actualiza `.env`:

```bash
SITE_PROFILE_PATH=./config/custom-profile.json
SELLER_PURCHASED_ORDERS_URL=https://sellercenter.falabella.com/order/invoice#/purchased-order-list
SELLER_USERNAME=tu-usuario
SELLER_PASSWORD=tu-clave
SUNAT_USERNAME=tu-usuario-sol
SUNAT_PASSWORD=tu-clave-sol
HEADFUL=true
RUN_MODE=manual
CHECK_INTERVAL_MINUTES=60
```

## Comandos útiles

```bash
npm start          # levanta el panel y la automatización
npm run dev        # modo watch
npm test           # ejecuta las pruebas
npm run typecheck  # valida TypeScript
npm run reset:data # limpia db local, capturas, trazas y auth state
```

## Artefactos

Los artefactos se guardan en `data/`:

- `data/automation.db`: estado local y deduplicación
- `data/screenshots/`: capturas del seller, revisión SUNAT, confirmación y errores
- `data/traces/`: trazas de Playwright
- `data/auth/`: estado de autenticación guardado

## Alcance actual

- v1 es local-first y de ejecución única
- cada venta se convierte en una factura
- el envío final a SUNAT siempre requiere aprobación
- la extracción real de Falabella está integrada
- la parte de SUNAT queda lista para configurar con URLs y selectores reales en `config/custom-profile.json`
