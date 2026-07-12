# Charla — Chat en tiempo real con Supabase

Sistema de mensajería 1 a 1 y grupal. Frontend en HTML/CSS/JS puro (sin build),
backend completo en Supabase (auth, base de datos, tiempo real). Pensado para
desplegarse gratis en GitHub Pages.

## Estructura del proyecto

```
chat-app/
├── index.html          Página de login / registro
├── chat.html           Aplicación de chat
├── css/styles.css       Estilos
├── js/
│   ├── supabase-config.js   Credenciales de Supabase (edítalo)
│   ├── auth.js               Lógica de login/registro
│   └── chat.js                Lógica de conversaciones y mensajes
└── sql/schema.sql       Script para crear las tablas en Supabase
```

## 1. Crear el proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → **New project**.
2. Elige nombre, contraseña de base de datos y región (idealmente cercana, ej. `São Paulo` para Chile).
3. Espera a que el proyecto termine de aprovisionarse (~2 min).

## 2. Crear las tablas

1. En el panel de Supabase, ve a **SQL Editor → New query**.
2. Copia y pega **todo** el contenido de `sql/schema.sql`.
3. Ejecuta (`Run`). Esto crea las tablas `profiles`, `conversations`,
   `conversation_participants`, `messages`, sus políticas de seguridad (RLS)
   y activa el tiempo real sobre `messages`.

## 3. Configurar autenticación

Por defecto Supabase pide confirmación de correo. Para pruebas rápidas puedes
desactivarla en **Authentication → Providers → Email → Confirm email** (desmarcar).
Para producción, déjala activada y configura tu propio remitente SMTP en
**Authentication → Settings**.

## 4. Conectar el frontend a tu proyecto

1. En Supabase ve a **Project Settings → API**.
2. Copia el **Project URL** y la **anon public key**.
3. Abre `js/supabase-config.js` y reemplaza:

```js
export const SUPABASE_URL = "https://TU-PROYECTO.supabase.co";
export const SUPABASE_ANON_KEY = "TU-ANON-KEY-PUBLICA";
```

> La `anon key` es segura para exponer en el frontend: es pública por diseño,
> y la seguridad real la dan las políticas RLS que ya creaste en el paso 2.

## 5. Probar en local

No necesitas ningún servidor de build. Basta con abrir el proyecto con un
servidor estático simple (los módulos ES requieren `http://`, no `file://`):

```bash
# Con Python
python3 -m http.server 5500

# o con la extensión "Live Server" de VS Code
```

Abre `http://localhost:5500`, crea una cuenta, y prueba a abrir una segunda
sesión en modo incógnito con otro usuario para chatear entre ambos.

## 6. Subir el proyecto a GitHub

```bash
cd chat-app
git init
git add .
git commit -m "Chat inicial con Supabase"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

## 7. Desplegar en GitHub Pages

1. En tu repositorio de GitHub, ve a **Settings → Pages**.
2. En **Source**, elige la rama `main` y la carpeta `/ (root)`.
3. Guarda. GitHub te dará una URL tipo `https://tu-usuario.github.io/tu-repo/`
   en uno o dos minutos.
4. Abre esa URL — tu chat ya está en producción, conectado a Supabase.

> Como todo el backend vive en Supabase, GitHub Pages (que solo sirve archivos
> estáticos) es suficiente: no necesitas un servidor propio.

## Cómo funciona el modelo de datos

- **profiles**: uno por usuario, se crea automáticamente al registrarse (trigger `handle_new_user`).
- **conversations**: una fila por chat, `is_group` distingue 1 a 1 de grupal.
- **conversation_participants**: tabla puente, define quién está en cada conversación.
- **messages**: cada mensaje, enlazado a su conversación y su remitente.

Las políticas RLS aseguran que un usuario solo puede leer/escribir mensajes de
conversaciones donde figura como participante — esto se aplica a nivel de base
de datos, no solo en el frontend.

## Próximos pasos posibles

- Indicador de "escribiendo..." usando Supabase Presence.
- Estado en línea/desconectado real (ya existe la columna `status` en `profiles`).
- Subida de imágenes/archivos con Supabase Storage.
- Notificaciones push con Service Workers.
