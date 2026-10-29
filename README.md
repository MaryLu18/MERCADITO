# Mercadito

Tienda con **dos roles**: clientes (cuenta opcional) y administrador (acceso oculto + portal de edición).
Sin build: HTML estático + funciones en `api/` + base de datos Upstash Redis.

## Estructura
```
public/index.html   Tienda pública (cliente)
public/admin.html   Portal del administrador (si no hay sesión de admin, redirige a la tienda sin mostrar nada)
api/shop.js         GET  catálogo público
api/order.js        POST pedido: descuenta el stock en el servidor
api/auth.js         POST registro/ingreso de clientes y acceso del administrador
api/admin.js        POST acciones del portal (solo con sesión de rol admin)
lib/store.js        Redis, sesiones firmadas, contraseñas (scrypt) y límite de intentos
```

## Roles
| | Cliente | Administrador |
|---|---|---|
| Ver catálogo y comprar | Sí (con o sin cuenta) | Sí |
| Cuenta, "Mis pedidos" | Sí (opcional) | – |
| Portal `/admin`: productos, stock, categorías, imágenes, textos, QR, pedidos, clientes | **No** | **Sí** |

## Cómo entra el administrador (oculto)
En la tienda no hay botón ni enlace. Pulsa **5 veces seguidas el logo "Mercadito"** (arriba a la izquierda): aparece un cuadro de usuario y contraseña. Si son correctos te lleva a `/admin`.
Quien abra `/admin` sin haber iniciado sesión es devuelto a la tienda sin ver nada. La seguridad real está en el servidor: todas las acciones del portal exigen una sesión firmada con rol admin, y se bloquea la IP tras 8 intentos fallidos durante 15 minutos.

## Publicar en 5 pasos
1. **GitHub:** crea un repositorio vacío y sube esta carpeta.
   ```bash
   git init && git add . && git commit -m "Mercadito"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/mercadito.git
   git push -u origin main
   ```
2. **Vercel:** *Add New → Project*, importa el repositorio y pulsa *Deploy*.
3. **Base de datos:** en el proyecto, *Storage* (o *Marketplace*) → **Upstash Redis** → crear y conectar al proyecto. Vercel añade `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
4. **Credenciales:** en *Settings → Environment Variables* crea `ADMIN_USER` y `ADMIN_PASSWORD` (usuario y contraseña que solo tú sabes). Opcional: `SESSION_SECRET` con un texto largo al azar.
5. **Redeploy:** *Deployments →* último despliegue *→ Redeploy*.

## Primer uso
Entra con el truco del logo, crea tus categorías y productos, sube tu QR en **Tienda y QR** y comparte el enlace `.vercel.app`.
Cada pedido descuenta el stock al instante y la tienda se actualiza sola cada 20 segundos.

## Pagos
El pago es manual: el cliente escanea tu QR, escribe nombre y teléfono y pulsa *Ya realicé el pago*. Tú confirmas el dinero en tu app de pagos, ves el pedido en el portal y lo entregas.

## Límites
- Las imágenes se guardan en la base de datos (máx. 4 por producto, reducidas). Para un catálogo grande conviene Vercel Blob o Cloudinary.
- Una sola cuenta de administrador. Se guardan los últimos 200 pedidos (30 por cliente).
- Cambia la contraseña editando `ADMIN_PASSWORD` en Vercel y haciendo Redeploy.
