# Mercadito

Tienda sin cuentas para los clientes (el carrito se guarda en su navegador) y un portal de administración oculto.
Sin build: HTML estático + funciones en `api/` + base de datos Upstash Redis.

## Estructura
```
public/index.html   Tienda pública
public/admin.html   Portal del administrador (sin sesión, redirige a la tienda sin mostrar nada)
api/shop.js         GET  catálogo público
api/order.js        POST pedido: descuenta el stock en el servidor
api/auth.js         POST acceso del administrador
api/admin.js        POST acciones del portal (solo con sesión de administrador)
lib/store.js        Redis, sesión firmada, credenciales y límite de intentos
```

## Clientes
- No hay registro ni inicio de sesión: entran y compran con nombre y teléfono.
- **El carrito se guarda en el navegador** (localStorage): sobrevive a recargas y a cerrar la página, en ese mismo dispositivo. Al volver, se quitan los productos agotados o eliminados y se ajustan las cantidades al stock.

## Administrador (oculto)
- En la tienda no hay botón ni enlace. Pulsa **8 veces seguidas el logo "Mercadito"** y aparece el cuadro de acceso.
- Usuario y contraseña: los que están en `lib/store.js` (`ADMIN_USER` / `ADMIN_PASSWORD`). Para cambiarlos sin tocar el código, crea esas variables en Vercel (tienen prioridad) y haz Redeploy.
- Si el repositorio de GitHub es **público**, cualquiera puede leer esas credenciales en `lib/store.js`. Crea el repositorio como **Private**, o define las variables en Vercel y borra los valores por defecto del archivo.
- El servidor rechaza cualquier cambio sin sesión de administrador y bloquea la IP 15 minutos tras 8 intentos fallidos.

## Publicar en 5 pasos
1. **GitHub:** crea un repositorio **privado** y sube esta carpeta.
   ```bash
   git init && git add . && git commit -m "Mercadito"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mercadito.git
   git push -u origin main
   ```
2. **Vercel:** *Add New → Project*, importa el repositorio y pulsa *Deploy*.
3. **Base de datos:** *Storage* (o *Marketplace*) → **Upstash Redis** → crear y conectar al proyecto. Vercel añade `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. **Redeploy:** *Deployments →* último despliegue *→ Redeploy*.
5. Entra con las 8 pulsaciones al logo, crea categorías y productos, sube tu QR en **Tienda y QR** y comparte el enlace.

## Pagos
El cliente escanea tu QR, escribe nombre y teléfono y pulsa *Ya realicé el pago*. Tú confirmas el dinero en tu app de pagos, ves el pedido en el portal y lo entregas. La página no verifica el pago.

## Límites
- Las imágenes se guardan en la base de datos (máx. 4 por producto, reducidas).
- Una sola cuenta de administrador. Se guardan los últimos 200 pedidos.
