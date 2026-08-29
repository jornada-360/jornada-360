# Planificador semanal de locales

Primera versión del flujo **Excel → importar → revisar → validar → corregir → exportar**.

## Ejecutar

```powershell
npm.cmd install
npm.cmd start
```

Abra `http://localhost:3100`. Los datos se guardan en `data/planning.db`; originales y exportaciones se conservan en carpetas separadas. Puede cambiar el puerto con la variable `PORT`.

## Pruebas

```powershell
npm.cmd test
npm.cmd run typecheck
```

La autenticación se integra mediante cabeceras `x-user` y `x-role` (`ADMIN`, `IMPORTER`, `PLANNER`, `VIEWER`). En desarrollo, la interfaz usa `ADMIN`.

## GitHub Pages (versión estática)

La versión publicada procesa los archivos Excel completamente en el navegador. Los archivos, las validaciones y las correcciones no se envían ni se almacenan en un servidor.

```powershell
npm.cmd ci
npm.cmd run build:pages
```

El contenido publicable queda en `public`. El workflow `.github/workflows/pages.yml` lo publica automáticamente al enviar cambios a la rama `main`.
