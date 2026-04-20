## Desktop (Electron)

Este paquete convierte el dashboard web en una app de escritorio (Electron).

### Dev

En una terminal:

```bash
npm install
npm run desktop:dev
```

Esto levanta:

- backend (Express) en `http://127.0.0.1:3030`
- frontend (Vite) en `http://127.0.0.1:5173`
- Electron apuntando a Vite

### Build / Package

```bash
npm run desktop:package
```

Primero construye `frontend/dist`, y luego genera instaladores (según tu OS) con electron-builder.

