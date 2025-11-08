# 🚀 Desplegar Evolution API Multi-Container en Railway

Esta guía te ayudará a desplegar la arquitectura completa de Evolution API en Railway con múltiples servicios.

## 📋 Arquitectura

Tu setup incluye 4 servicios:
- **evolution_api**: API principal de Evolution
- **evolution_postgres**: Base de datos PostgreSQL
- **evolution_redis**: Caché Redis
- **evolution_frontend**: Interfaz de gestión web

## 🎯 Opción 1: Railway con Docker Compose (Recomendado)

Railway ahora soporta Docker Compose nativamente, lo que te permite desplegar todos los servicios juntos.

### Paso 1: Preparar el Repositorio

1. **Crear un repositorio en GitHub** con estos archivos:
   ```
   proyecto-evolution/
   ├── docker-compose.yaml
   ├── .dockerignore
   └── .env (no commitear este archivo!)
   ```

2. **Crear `.gitignore`**:
   ```gitignore
   .env
   node_modules
   dist
   ```

3. **Push al repositorio**:
   ```bash
   git init
   git add docker-compose.yaml .dockerignore .gitignore
   git commit -m "Initial Evolution API setup"
   git remote add origin [tu-repo-url]
   git push -u origin main
   ```

### Paso 2: Crear Proyecto en Railway

1. Ve a [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona tu repositorio
4. Railway detectará automáticamente el `docker-compose.yaml`

### Paso 3: Configurar Variables de Entorno

Railway creará 4 servicios automáticamente. Configura las variables en cada uno:

#### 🔵 **Service: api (evolution_api)**

```env
# Server
SERVER_NAME=evolution
SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=${{RAILWAY_PUBLIC_DOMAIN}}

# Database (usa referencias internas de Railway)
DATABASE_PROVIDER=postgresql
POSTGRES_DATABASE=evolution_db
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=${{POSTGRES_PASSWORD}}
DATABASE_CONNECTION_URI=postgresql://postgres:${{POSTGRES_PASSWORD}}@evolution-postgres.railway.internal:5432/evolution_db?schema=evolution_api
DATABASE_CONNECTION_CLIENT_NAME=evolution_exchange

# Data saving
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=false
DATABASE_SAVE_DATA_HISTORIC=false
DATABASE_DELETE_MESSAGE=true

# Authentication
AUTHENTICATION_API_KEY=${{EVOLUTION_API_KEY}}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true

# Cache (usa referencia interna de Railway)
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://evolution-redis.railway.internal:6379/6
CACHE_REDIS_TTL=604800
CACHE_LOCAL_ENABLED=false

# CORS
CORS_ORIGIN=*
CORS_METHODS=GET,POST,PUT,DELETE
CORS_CREDENTIALS=true

# Logs
LOG_LEVEL=ERROR,WARN,INFO,LOG,WEBHOOKS
LOG_COLOR=true
LOG_BAILEYS=error

# Disable integrations
RABBITMQ_ENABLED=false
SQS_ENABLED=false
KAFKA_ENABLED=false
NATS_ENABLED=false
PUSHER_ENABLED=false
CHATWOOT_ENABLED=false
OPENAI_ENABLED=false
DIFY_ENABLED=false
N8N_ENABLED=false
EVOAI_ENABLED=false
TYPEBOT_ENABLED=false
S3_ENABLED=false

# Webhook (configurar después de tener URL de Supabase)
WEBHOOK_GLOBAL_ENABLED=true
WEBHOOK_GLOBAL_URL=${{SUPABASE_WEBHOOK_URL}}
WEBHOOK_EVENTS_MESSAGES_UPSERT=true
WEBHOOK_EVENTS_MESSAGES_UPDATE=true
WEBHOOK_EVENTS_MESSAGES_DELETE=true
WEBHOOK_EVENTS_QRCODE_UPDATED=true
WEBHOOK_EVENTS_CONNECTION_UPDATE=true
WEBHOOK_EVENTS_SEND_MESSAGE=true
WEBHOOK_EVENTS_ERRORS=true

# WhatsApp
CONFIG_SESSION_PHONE_CLIENT=Evolution API
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
QRCODE_COLOR=#175197
LANGUAGE=es
```

#### 🟢 **Service: evolution-postgres**

```env
POSTGRES_DB=evolution_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=[generar-password-seguro]
```

**Importante**: Railway auto-genera `POSTGRES_PASSWORD`, cópialo para usar en el servicio `api`.

#### 🔴 **Service: redis**

No requiere variables adicionales. Railway lo configurará automáticamente.

#### 🟡 **Service: frontend**

```env
# No requiere variables especiales
# Se conectará automáticamente al API
```

### Paso 4: Exponer Servicios Públicamente

En Railway, configura los dominios públicos:

1. **api (evolution_api)**:
   - Settings → Networking → Generate Domain
   - Obtendrás algo como: `evolution-api-production-xxx.up.railway.app`
   - **Guarda esta URL** para configurar webhooks

2. **frontend (opcional)**:
   - Settings → Networking → Generate Domain
   - Para acceder a la interfaz de gestión

### Paso 5: Configurar Webhooks en Supabase

Una vez tengas la URL pública del API:

```env
# En el servicio api de Railway, actualiza:
WEBHOOK_GLOBAL_URL=https://[tu-proyecto].supabase.co/functions/v1/evolution-webhook
```

### Paso 6: Conectar WhatsApp

1. Accede al frontend: `https://[tu-frontend].up.railway.app`
2. **Login**:
   - API Key: (el que configuraste en `AUTHENTICATION_API_KEY`)
   - API URL: `https://[tu-api].up.railway.app`
3. **Crear instancia**:
   - Nombre: (ej. "lapacho_bot")
   - Webhook: `https://[tu-proyecto].supabase.co/functions/v1/evolution-webhook`
   - Events: Habilita `messages.upsert`, `messages.update`
4. **Escanear QR** con WhatsApp Business

---

## 🎯 Opción 2: Servicios Separados en Railway (Más Control)

Si prefieres más control, puedes crear cada servicio manualmente:

### 1. PostgreSQL
```bash
# Railway ofrece PostgreSQL como servicio managed
New → Database → PostgreSQL
# Copia las credenciales generadas
```

### 2. Redis
```bash
# Railway ofrece Redis como servicio managed
New → Database → Redis
# Copia la URL de conexión
```

### 3. Evolution API
```bash
New → GitHub Repo → [crear repo solo con la config del API]
```

**Dockerfile para el API**:
```dockerfile
FROM evoapicloud/evolution-api:latest
ENV NODE_ENV=production
EXPOSE 8080
```

### 4. Frontend (opcional)
```bash
New → GitHub Repo → [crear repo del frontend]
```

**Dockerfile para el Frontend**:
```dockerfile
FROM evoapicloud/evolution-manager:latest
EXPOSE 80
```

---

## 📊 Configuración de Networking en Railway

Railway usa **networking privado** entre servicios. Las URLs internas son:

```
evolution-postgres.railway.internal:5432
evolution-redis.railway.internal:6379
evolution-api.railway.internal:8080
```

**Importante**: Solo el API y el Frontend necesitan dominios públicos.

---

## 💰 Costos Estimados en Railway

- **PostgreSQL**: ~$3-5/mes (según uso)
- **Redis**: ~$2-3/mes
- **Evolution API**: ~$3-5/mes
- **Frontend**: ~$1-2/mes

**Total**: ~$10-15/mes (mucho más barato que servicios managed)

---

## 🔒 Checklist de Seguridad

- [ ] Generar `AUTHENTICATION_API_KEY` segura (usa: `openssl rand -hex 16`)
- [ ] Usar PostgreSQL password segura (Railway la genera automáticamente)
- [ ] Configurar `CORS_ORIGIN` con dominios específicos en producción
- [ ] Habilitar solo los eventos de webhook necesarios
- [ ] Limitar acceso al frontend con IP whitelist (opcional)
- [ ] Configurar backups de PostgreSQL en Railway

---

## 🧪 Testing Post-Deploy

1. **Verificar API**:
   ```bash
   curl https://[tu-api].up.railway.app/instance/fetchInstances \
     -H "apikey: [tu-api-key]"
   ```

2. **Verificar Redis**:
   - Logs del servicio api deben mostrar: "Redis connected"

3. **Verificar PostgreSQL**:
   - Logs del servicio api deben mostrar: "Database connected"

4. **Verificar Frontend**:
   - Acceder a `https://[tu-frontend].up.railway.app`
   - Login con API key

5. **Crear instancia de prueba**:
   - En el frontend, crear nueva instancia
   - Escanear QR code
   - Enviar mensaje de prueba al bot

---

## 🚨 Troubleshooting

### Error: "Connection refused to postgres"
- Verifica que `DATABASE_CONNECTION_URI` use el hostname interno: `evolution-postgres.railway.internal`
- Verifica que el servicio PostgreSQL esté running

### Error: "Redis connection failed"
- Verifica que `CACHE_REDIS_URI` use el hostname interno: `evolution-redis.railway.internal`
- Verifica que el servicio Redis esté running

### Webhook no recibe mensajes
- Verifica que `WEBHOOK_GLOBAL_URL` apunte a tu edge function de Supabase
- Verifica que `WEBHOOK_EVENTS_MESSAGES_UPSERT=true`
- Revisa logs en Supabase edge function

### No puedo escanear QR code
- Verifica que `SERVER_URL` esté configurado con tu dominio público de Railway
- Verifica que el puerto 8080 esté expuesto
- Intenta regenerar el QR

---

## 📚 Próximos Pasos

Después de deployar Evolution API:

1. ✅ Configurar secrets en Supabase (Fase 4 del plan de migración)
2. ✅ Actualizar edge functions con nuevo project_id (Fase 5)
3. ✅ Crear archivo de configuración multi-ambiente en el frontend (Fase 6)
4. ✅ Conectar primera instancia de WhatsApp (Fase 7)
5. ✅ Testing completo (Fase 8)

---

## 🔗 Enlaces Útiles

- [Railway Docs](https://docs.railway.app/)
- [Evolution API Docs](https://doc.evolution-api.com/)
- [Docker Compose en Railway](https://docs.railway.app/guides/dockerfiles)
