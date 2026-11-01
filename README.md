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
- Usuario y contraseña iniciales: los de `lib/store.js` (o `ADMIN_USER` / `ADMIN_PASSWORD` si los defines en Vercel). **Solo se usan en el primer ingreso**: ahí quedan guardados cifrados en la base de datos y, desde el portal (**Tienda y QR → Acceso de administrador**), puedes cambiarlos sin tocar el código ni hacer Redeploy.
- Una vez cambiados, los valores del código ya no sirven. Mientras no los cambies, si el repositorio es **público** cualquiera puede leerlos: crea el repositorio como **Private** y cámbialos en el primer ingreso.
- Si olvidas la contraseña: en Upstash abre *Data Browser*, borra la clave `admin` y vuelve a entrar con los valores iniciales.
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
5. Entra con las 8 pulsaciones al logo, crea categorías y productos, sube tu QR en **QR y acceso** (pestaña "Tienda y QR") y comparte el enlace.

## Pagos
El cliente escanea tu QR, escribe nombre y teléfono y pulsa *Ya realicé el pago*. Tú confirmas el dinero en tu app de pagos, ves el pedido en el portal y lo entregas. La página no verifica el pago.

## Límites
- Las imágenes se guardan en la base de datos (máx. 4 por producto, reducidas).
- Una sola cuenta de administrador. Se guardan los últimos 200 pedidos.

## Base de datos (Upstash Redis)
Redis no usa tablas: la aplicación crea sola estas claves al usarse, no tienes que crear nada a mano.

| Clave | Contenido |
|---|---|
| `products` (hash) | un producto por campo: título, precio, categoría, descripción, imágenes |
| `stock` (hash) | unidades disponibles por producto (se descuentan de forma atómica) |
| `config` | categorías, imágenes de las cajas, textos de portada y QR de pago |
| `orders` (lista) | últimos 200 pedidos |
| `admin` | usuario del administrador y su contraseña cifrada (scrypt con sal) |
| `secret` | clave aleatoria con la que se firman las sesiones |
| `rl:<ip>` | contador temporal de intentos fallidos |

## Categorías, menú y diseño
- La tienda arranca con las categorías **Resistencias, Diodos, LEDs y Transistores**, más **Todo** (botón fijo que muestra los artículos de todas). Están definidas en `public/index.html` (variable `CATS`) y en `public/admin.html`.
- Desde el portal, pestaña **Categorías**: añade, renombra o elimina categorías (los productos de una categoría eliminada pasan a "Sin categoría" y siguen en *Todo*) y cambia la **imagen del rectángulo grande** de cada una, incluida la de *Todo*. Si no subes foto, se muestra una ilustración del componente.
- El menú superior se acomoda solo: si agregas más categorías pasa a otra línea (en el celular también).
- Cada categoría tiene su propio buscador y orden por precio. La dirección cambia con la categoría (`/#Diodos`), así que funciona el botón "atrás" y se pueden compartir enlaces directos.
- Efectos: al pasar el cursor, una línea se despliega desde la derecha bajo el nombre; la categoría activa se resalta con otro color. El slogan se mueve en bucle infinito (marquee) sobre el menú; para cambiarlo edita la variable `s` del pequeño script que está justo después de `</header>` en `public/index.html`.
- Estética: tema oscuro grafito con violeta, azul y naranja de acento, tarjetas redondeadas y formas 3D, inspirado en la imagen de referencia.
- Las imágenes se reducen y se guardan en la base de datos; el conjunto de imágenes de categorías y QR no debe pasar de unos 900 KB. Si el portal avisa que pesan demasiado, quita alguna.

## WhatsApp del pedido
En `public/index.html`, busca `WHATSAPP_NUMBER` (al inicio del script) y pon tu número solo con dígitos y con indicativo de país, por ejemplo `'573001234567'`. Al confirmar el pedido, la tienda cierra la ventana de pago, vacía el carrito y abre WhatsApp con el mensaje: artículos con cantidades, nombre y teléfono del cliente.
