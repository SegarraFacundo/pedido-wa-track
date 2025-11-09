# Guía de Despliegue: Evolution API en DigitalOcean Droplet

Esta guía te llevará paso a paso para desplegar Evolution API multi-container en un VPS de DigitalOcean usando Docker Compose, con configuración completa de seguridad, HTTPS, y backups automáticos.

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Fase 1: Provisionar VPS](#fase-1-provisionar-vps)
3. [Fase 2: Configuración Inicial del Servidor](#fase-2-configuración-inicial-del-servidor)
4. [Fase 3: Instalar Docker y Docker Compose](#fase-3-instalar-docker-y-docker-compose)
5. [Fase 4: Configurar Firewall](#fase-4-configurar-firewall)
6. [Fase 5: Desplegar Evolution API](#fase-5-desplegar-evolution-api)
7. [Fase 6: Configurar Nginx (Reverse Proxy)](#fase-6-configurar-nginx-reverse-proxy)
8. [Fase 7: Instalar SSL con Let's Encrypt](#fase-7-instalar-ssl-con-lets-encrypt)
9. [Fase 8: Configurar Backups Automáticos](#fase-8-configurar-backups-automáticos)
10. [Fase 9: Configurar WhatsApp](#fase-9-configurar-whatsapp)
11. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
12. [Troubleshooting](#troubleshooting)

---

## Requisitos Previos

### ✅ Antes de comenzar necesitas:

1. **Cuenta en DigitalOcean** (o Vultr, Linode, Hetzner)
2. **Dominio propio** (ejemplo: `tudominio.com`)
   - Acceso al panel de DNS del dominio
   - Necesario para SSL con Let's Encrypt
3. **Proyecto Supabase** en producción ya configurado
4. **Archivos del proyecto**:
   - `docker-compose.yaml`
   - `.env.evolution.example` (renombrar a `.env`)
   - `.dockerignore`

### 💰 Costos Estimados

| Servicio | Especificaciones | Costo Mensual |
|----------|------------------|---------------|
| **DigitalOcean Droplet** | 2GB RAM, 2 vCPU, 50GB SSD | $12/mes |
| **Dominio** | .com / .net / etc | $10-15/año |
| **Total** | | **~$12-13/mes** |

**Nota**: El plan de 1GB RAM ($6/mes) puede funcionar, pero el de 2GB RAM ($12/mes) es más estable para producción.

---

## Fase 1: Provisionar VPS

### 1.1 Crear Cuenta en DigitalOcean

1. Ve a [https://digitalocean.com](https://digitalocean.com)
2. Regístrate y verifica tu cuenta
3. Agrega método de pago

### 1.2 Crear Droplet

1. **Dashboard** → **Create** → **Droplets**

2. **Configuración recomendada**:
   - **Imagen**: Ubuntu 22.04 LTS (x64)
   - **Plan**: Basic
   - **CPU Options**: Regular (2GB RAM / 2 vCPU) - **$12/mes**
   - **Región**: Más cercana a tus usuarios
     - São Paulo (Brasil)
     - New York (USA)
     - Amsterdam (Europa)
   - **Autenticación**: SSH Key (más seguro que password)

3. **SSH Key Setup** (si no tienes una):
   
   En tu computadora local:
   ```bash
   ssh-keygen -t rsa -b 4096 -C "tu-email@ejemplo.com"
   cat ~/.ssh/id_rsa.pub
   ```
   
   Copia el contenido y pégalo en DigitalOcean

4. **Hostname**: `evolution-api-prod`

5. **Create Droplet**

6. **⚠️ IMPORTANTE**: Anota la **IP pública** del droplet (ejemplo: `147.182.150.42`)

---

## Fase 2: Configuración Inicial del Servidor

### 2.1 Conectar al Servidor

```bash
ssh root@[IP-DEL-DROPLET]
```

Ejemplo:
```bash
ssh root@147.182.150.42
```

### 2.2 Actualizar Sistema

```bash
apt update && apt upgrade -y
```

### 2.3 Crear Usuario No-Root (Opcional pero Recomendado)

```bash
# Crear usuario
adduser deploy

# Agregar a grupo sudo
usermod -aG sudo deploy

# Copiar SSH keys al nuevo usuario
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

**Desde ahora usa el nuevo usuario**:
```bash
ssh deploy@[IP-DEL-DROPLET]
```

### 2.4 Configurar Timezone (Recomendado)

```bash
# Ver timezone actual
timedatectl

# Configurar a Argentina
sudo timedatectl set-timezone America/Argentina/Buenos_Aires

# Verificar
date
```

---

## Fase 3: Instalar Docker y Docker Compose

### 3.1 Instalar Docker

```bash
# Script oficial de instalación
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar tu usuario al grupo docker (evita usar sudo cada vez)
sudo usermod -aG docker $USER

# Activar cambios (o cierra y reconecta SSH)
newgrp docker

# Habilitar Docker al inicio
sudo systemctl enable docker
sudo systemctl start docker

# Verificar instalación
docker --version
docker run hello-world
```

### 3.2 Instalar Docker Compose

```bash
# Instalar desde repositorios
sudo apt install docker-compose -y

# Verificar instalación
docker-compose --version
```

**Salida esperada**: `docker-compose version 1.29.2, build ...`

---

## Fase 4: Configurar Firewall

### 4.1 Configurar UFW (Uncomplicated Firewall)

```bash
# Permitir SSH (¡IMPORTANTE! No te bloquees)
sudo ufw allow OpenSSH

# Permitir HTTP (puerto 80 - necesario para Let's Encrypt)
sudo ufw allow 80/tcp

# Permitir HTTPS (puerto 443)
sudo ufw allow 443/tcp

# Permitir Evolution API (opcional, solo si necesitas acceso directo)
# sudo ufw allow 8080/tcp

# Activar firewall
sudo ufw enable

# Verificar estado
sudo ufw status verbose
```

**Salida esperada**:
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp (OpenSSH)          ALLOW       Anywhere
80/tcp                    ALLOW       Anywhere
443/tcp                   ALLOW       Anywhere
```

### 4.2 Configurar Fail2Ban (Opcional - Mayor Seguridad)

Protege contra ataques de fuerza bruta SSH:

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Fase 5: Desplegar Evolution API

### 5.1 Crear Estructura de Directorios

```bash
# Crear directorio principal
sudo mkdir -p /opt/evolution
sudo chown $USER:$USER /opt/evolution
cd /opt/evolution

# Crear directorios para backups
mkdir -p backups
mkdir -p logs
```

### 5.2 Subir Archivos desde Tu Computadora Local

**Desde tu computadora local** (no en el servidor), en el directorio del proyecto:

```bash
# Subir docker-compose.yaml
scp docker-compose.yaml deploy@[IP-DEL-DROPLET]:/opt/evolution/

# Subir archivo .env (renombrar de .env.evolution.example)
cp .env.evolution.example .env
scp .env deploy@[IP-DEL-DROPLET]:/opt/evolution/

# Subir .dockerignore
scp .dockerignore deploy@[IP-DEL-DROPLET]:/opt/evolution/
```

Ejemplo:
```bash
scp docker-compose.yaml deploy@147.182.150.42:/opt/evolution/
scp .env deploy@147.182.150.42:/opt/evolution/
scp .dockerignore deploy@147.182.150.42:/opt/evolution/
```

### 5.3 Configurar Variables de Entorno

**En el servidor**, editar el archivo `.env`:

```bash
cd /opt/evolution
nano .env
```

**Variables críticas a actualizar**:

```env
########################################
# 🔧 SERVER CONFIG
########################################
SERVER_URL=http://[IP-DEL-DROPLET]:8080
# NOTA: Después de configurar SSL, cambiarás esto a https://evolution.tudominio.com

########################################
# 🧠 AUTHENTICATION
########################################
AUTHENTICATION_API_KEY=TU_API_KEY_SEGURA_AQUI
# ⚠️ IMPORTANTE: Genera una key segura, por ejemplo:
# openssl rand -hex 32

########################################
# 🔔 WEBHOOK CONFIG
########################################
WEBHOOK_GLOBAL_URL=https://[proyecto-supabase].supabase.co/functions/v1/evolution-webhook
# Reemplaza [proyecto-supabase] con tu proyecto real de Supabase
WEBHOOK_GLOBAL_ENABLED=false
# Nota: Después configurarás esto por instancia, no globalmente
```

**Ejemplo**:
```env
SERVER_URL=http://147.182.150.42:8080
AUTHENTICATION_API_KEY=a3f8b9c2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0
WEBHOOK_GLOBAL_URL=https://ilhpiarkmwdjvrfqhyhi.supabase.co/functions/v1/evolution-webhook
```

Guardar: `Ctrl+O`, `Enter`, `Ctrl+X`

### 5.4 Iniciar Containers

```bash
cd /opt/evolution

# Descargar imágenes
docker-compose pull

# Iniciar en segundo plano
docker-compose up -d

# Ver estado
docker-compose ps
```

**Salida esperada**:
```
       Name                     Command               State           Ports
----------------------------------------------------------------------------------
evolution_api         docker-entrypoint.sh node ...   Up      0.0.0.0:8080->8080/tcp
evolution_frontend    /docker-entrypoint.sh ngin...   Up      0.0.0.0:3000->80/tcp
evolution_postgres    docker-entrypoint.sh postgres   Up      5432/tcp
evolution_redis       docker-entrypoint.sh redis...   Up      6379/tcp
```

### 5.5 Verificar Logs

```bash
# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs solo de API
docker-compose logs -f api

# Ver últimas 100 líneas
docker-compose logs --tail=100 api
```

### 5.6 Probar API

```bash
# Desde el servidor
curl http://localhost:8080/instance/fetchInstances \
  -H "apikey: TU_API_KEY_AQUI"
```

**Salida esperada** (si no hay instancias aún):
```json
[]
```

O desde tu computadora:
```bash
curl http://[IP-DEL-DROPLET]:8080/instance/fetchInstances \
  -H "apikey: TU_API_KEY_AQUI"
```

---

## Fase 6: Configurar Nginx (Reverse Proxy)

### 6.1 Configurar DNS del Dominio

**Antes de continuar**, configura tu dominio:

1. Ve al panel de DNS de tu proveedor de dominio
2. Crea un registro **A**:
   - **Nombre**: `evolution` (o el subdominio que prefieras)
   - **Tipo**: A
   - **Valor**: `[IP-DEL-DROPLET]`
   - **TTL**: 3600 (1 hora)

Ejemplo:
- `evolution.tudominio.com` → `147.182.150.42`

3. **Espera 5-15 minutos** para propagación DNS

4. **Verificar propagación**:
   ```bash
   nslookup evolution.tudominio.com
   # o
   dig evolution.tudominio.com
   ```

### 6.2 Instalar Nginx

```bash
sudo apt update
sudo apt install nginx -y

# Habilitar al inicio
sudo systemctl enable nginx
sudo systemctl start nginx

# Verificar estado
sudo systemctl status nginx
```

### 6.3 Crear Configuración de Nginx

```bash
sudo nano /etc/nginx/sites-available/evolution
```

**Contenido** (reemplaza `evolution.tudominio.com` con tu dominio):

```nginx
# Configuración para Evolution API
server {
    listen 80;
    listen [::]:80;
    server_name evolution.tudominio.com;

    # Logs
    access_log /var/log/nginx/evolution-access.log;
    error_log /var/log/nginx/evolution-error.log;

    # Aumentar tamaño máximo de body (para uploads de imágenes)
    client_max_body_size 20M;

    # Proxy a Evolution API
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        
        # Headers necesarios para WebSocket y proxy
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts aumentados para operaciones largas
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
        
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6.4 Activar Configuración

```bash
# Crear enlace simbólico
sudo ln -s /etc/nginx/sites-available/evolution /etc/nginx/sites-enabled/

# Probar configuración
sudo nginx -t
```

**Salida esperada**:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

```bash
# Recargar Nginx
sudo systemctl reload nginx
```

### 6.5 Probar Nginx

Desde tu navegador o computadora:
```bash
curl http://evolution.tudominio.com/instance/fetchInstances \
  -H "apikey: TU_API_KEY_AQUI"
```

---

## Fase 7: Instalar SSL con Let's Encrypt

### 7.1 Instalar Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### 7.2 Obtener Certificado SSL

```bash
sudo certbot --nginx -d evolution.tudominio.com
```

**Durante la instalación**:
1. **Email**: Ingresa tu email (para notificaciones de renovación)
2. **Terms**: Acepta los términos de servicio (A)
3. **Share email**: Opcional (Y/N)
4. **HTTP to HTTPS redirect**: **Sí (2)**

**Salida esperada**:
```
Congratulations! You have successfully enabled HTTPS on https://evolution.tudominio.com
```

### 7.3 Verificar Configuración SSL

Certbot automáticamente modifica tu archivo de Nginx. Verificar:

```bash
sudo cat /etc/nginx/sites-available/evolution
```

Ahora debería tener dos bloques `server`:
- Uno para puerto 80 (redirect a HTTPS)
- Uno para puerto 443 con SSL

### 7.4 Verificar Renovación Automática

```bash
# Probar renovación (dry-run)
sudo certbot renew --dry-run
```

**Salida esperada**:
```
Congratulations, all simulated renewals succeeded
```

Los certificados se renuevan automáticamente cada 60 días mediante un cron job.

### 7.5 Actualizar Variables de Entorno

**Actualizar `.env` con la nueva URL HTTPS**:

```bash
cd /opt/evolution
nano .env
```

Cambiar:
```env
SERVER_URL=https://evolution.tudominio.com
```

Guardar y reiniciar:
```bash
docker-compose restart api
```

### 7.6 Probar HTTPS

```bash
# Desde tu computadora
curl https://evolution.tudominio.com/instance/fetchInstances \
  -H "apikey: TU_API_KEY_AQUI"
```

Deberías obtener respuesta con el certificado SSL válido.

---

## Fase 8: Configurar Backups Automáticos

### 8.1 Crear Script de Backup

```bash
nano /opt/evolution/backup.sh
```

**Contenido**:

```bash
#!/bin/bash

# Configuración
BACKUP_DIR="/opt/evolution/backups"
CONTAINER_NAME="evolution_postgres"
DB_NAME="evolution_db"
DB_USER="postgres"
RETENTION_DAYS=7

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

# Timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/evolution_backup_$DATE.sql"

# Realizar backup
echo "🔄 Iniciando backup de PostgreSQL..."
docker exec $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

# Comprimir backup
gzip $BACKUP_FILE
echo "✅ Backup completado: ${BACKUP_FILE}.gz"

# Eliminar backups antiguos (mantener solo últimos 7 días)
find $BACKUP_DIR -name "evolution_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "🗑️  Backups antiguos eliminados (>$RETENTION_DAYS días)"

# Mostrar tamaño del backup
du -h ${BACKUP_FILE}.gz

# Log
echo "$(date): Backup completado" >> $BACKUP_DIR/backup.log
```

### 8.2 Dar Permisos de Ejecución

```bash
chmod +x /opt/evolution/backup.sh
```

### 8.3 Probar Script Manualmente

```bash
/opt/evolution/backup.sh
```

**Salida esperada**:
```
🔄 Iniciando backup de PostgreSQL...
✅ Backup completado: /opt/evolution/backups/evolution_backup_20240115_143022.sql.gz
🗑️  Backups antiguos eliminados (>7 días)
1.2M    /opt/evolution/backups/evolution_backup_20240115_143022.sql.gz
```

### 8.4 Configurar Cron Job (Backup Diario)

```bash
crontab -e
```

**Agregar al final** (backup diario a las 2:00 AM):

```cron
# Backup diario de Evolution API PostgreSQL a las 2:00 AM
0 2 * * * /opt/evolution/backup.sh >> /opt/evolution/backups/backup.log 2>&1
```

Guardar y salir.

### 8.5 Verificar Cron Job

```bash
crontab -l
```

### 8.6 Script de Restauración (Opcional)

Crear script para restaurar en caso de emergencia:

```bash
nano /opt/evolution/restore.sh
```

**Contenido**:

```bash
#!/bin/bash

if [ -z "$1" ]; then
    echo "❌ Error: Especifica el archivo de backup"
    echo "Uso: ./restore.sh /opt/evolution/backups/evolution_backup_YYYYMMDD_HHMMSS.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
CONTAINER_NAME="evolution_postgres"
DB_NAME="evolution_db"
DB_USER="postgres"

echo "⚠️  ADVERTENCIA: Esto sobrescribirá la base de datos actual"
echo "Backup a restaurar: $BACKUP_FILE"
read -p "¿Continuar? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Restauración cancelada"
    exit 0
fi

# Descomprimir si es .gz
if [[ $BACKUP_FILE == *.gz ]]; then
    echo "📦 Descomprimiendo backup..."
    gunzip -k $BACKUP_FILE
    BACKUP_FILE="${BACKUP_FILE%.gz}"
fi

# Restaurar
echo "🔄 Restaurando base de datos..."
docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME < $BACKUP_FILE

echo "✅ Restauración completada"
```

Dar permisos:
```bash
chmod +x /opt/evolution/restore.sh
```

---

## Fase 9: Configurar WhatsApp

### 9.1 Actualizar Secrets en Supabase

En tu proyecto de Supabase en producción, agregar/actualizar secrets:

```
EVOLUTION_API_URL=https://evolution.tudominio.com
EVOLUTION_API_KEY=[tu-api-key-del-.env]
```

### 9.2 Acceder al Frontend de Evolution

Opción 1: **Acceso directo por IP** (temporal):
```
http://[IP-DEL-DROPLET]:3000
```

Opción 2: **Configurar subdominio con Nginx** (recomendado):

```bash
sudo nano /etc/nginx/sites-available/evolution-frontend
```

**Contenido**:
```nginx
server {
    listen 80;
    server_name evolution-admin.tudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activar y configurar SSL:
```bash
sudo ln -s /etc/nginx/sites-available/evolution-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d evolution-admin.tudominio.com
```

### 9.3 Crear Instancia de WhatsApp

1. **Accede al frontend** (http://[IP]:3000 o https://evolution-admin.tudominio.com)

2. **Configuración de conexión**:
   - **API URL**: `https://evolution.tudominio.com`
   - **API Key**: (la que pusiste en `.env`)

3. **Crear instancia**:
   - **Instance Name**: `lapacho_bot` (o el nombre que prefieras)
   - **QR Code**: Activado
   - **Webhook**: `https://ilhpiarkmwdjvrfqhyhi.supabase.co/functions/v1/evolution-webhook`
   - **Webhook Events**: Marcar todos (especialmente `MESSAGES_UPSERT`)

4. **Escanear QR Code** con WhatsApp Business

5. **Verificar conexión** en el frontend (debería mostrar "Connected")

### 9.4 Probar Bot

Envía un mensaje al número de WhatsApp conectado y verifica que el bot responda.

---

## Monitoreo y Mantenimiento

### 📊 Ver Logs en Tiempo Real

```bash
# Todos los servicios
docker-compose logs -f

# Solo API
docker-compose logs -f api

# Solo PostgreSQL
docker-compose logs -f evolution-postgres

# Últimas 50 líneas
docker-compose logs --tail=50 api
```

### 🔍 Ver Estado de Containers

```bash
cd /opt/evolution
docker-compose ps
```

### 🔄 Reiniciar Servicios

```bash
# Reiniciar solo API
docker-compose restart api

# Reiniciar todos
docker-compose restart

# Reiniciar y reconstruir
docker-compose down && docker-compose up -d
```

### 📈 Ver Uso de Recursos

```bash
# Ver consumo en tiempo real
docker stats

# Ver uso de disco
df -h
du -sh /opt/evolution/*
```

### 🧹 Limpiar Docker

```bash
# Eliminar imágenes no usadas
docker image prune -a

# Eliminar volúmenes no usados
docker volume prune

# Limpieza completa (cuidado)
docker system prune -a --volumes
```

### 📦 Actualizar Evolution API

```bash
cd /opt/evolution

# Detener servicios
docker-compose down

# Descargar nuevas imágenes
docker-compose pull

# Iniciar con nuevas imágenes
docker-compose up -d

# Verificar logs
docker-compose logs -f api
```

### 🔐 Rotar API Key

```bash
# Generar nueva key
openssl rand -hex 32

# Actualizar .env
nano /opt/evolution/.env
# Cambiar AUTHENTICATION_API_KEY

# Reiniciar
docker-compose restart api

# Actualizar en Supabase secrets
# Actualizar en instancias de WhatsApp (frontend)
```

---

## Troubleshooting

### ❌ API no responde / Container se reinicia constantemente

**Verificar logs**:
```bash
docker-compose logs api
```

**Problemas comunes**:
1. **PostgreSQL no está listo**:
   - Esperar 30 segundos y revisar: `docker-compose logs evolution-postgres`
   
2. **Error de conexión a Redis**:
   ```bash
   docker-compose logs redis
   ```

3. **Variables de entorno incorrectas**:
   ```bash
   nano /opt/evolution/.env
   # Verificar DATABASE_CONNECTION_URI, CACHE_REDIS_URI
   ```

**Solución**:
```bash
docker-compose down
docker-compose up -d
docker-compose logs -f
```

---

### ❌ Webhook no recibe mensajes

**Verificar**:
1. **Webhook configurado en la instancia**:
   - Frontend → Instancia → Settings → Webhook URL

2. **Probar webhook manualmente**:
   ```bash
   curl -X POST https://ilhpiarkmwdjvrfqhyhi.supabase.co/functions/v1/evolution-webhook \
     -H "Content-Type: application/json" \
     -d '{
       "event": "messages.upsert",
       "instance": "lapacho_bot",
       "data": {
         "key": {
           "remoteJid": "5491112345678@s.whatsapp.net",
           "fromMe": false
         },
         "message": {
           "conversation": "test"
         }
       }
     }'
   ```

3. **Ver logs de Evolution API**:
   ```bash
   docker-compose logs -f api | grep -i webhook
   ```

4. **Ver logs de Supabase Edge Function**:
   - En Supabase Dashboard → Edge Functions → evolution-webhook → Logs

---

### ❌ SSL no funciona / Certificado expirado

**Verificar certificado**:
```bash
sudo certbot certificates
```

**Renovar manualmente**:
```bash
sudo certbot renew
sudo systemctl reload nginx
```

**Verificar auto-renovación**:
```bash
sudo systemctl status certbot.timer
```

---

### ❌ Puerto 8080 bloqueado / No accesible

**Verificar Nginx**:
```bash
sudo nginx -t
sudo systemctl status nginx
```

**Verificar firewall**:
```bash
sudo ufw status
```

**Verificar que Evolution API está corriendo**:
```bash
docker-compose ps
curl http://localhost:8080/instance/fetchInstances -H "apikey: TU_KEY"
```

---

### ❌ Backup falla / No se ejecuta

**Verificar manualmente**:
```bash
/opt/evolution/backup.sh
```

**Ver logs de backup**:
```bash
cat /opt/evolution/backups/backup.log
```

**Verificar cron**:
```bash
crontab -l
sudo systemctl status cron
```

**Verificar permisos**:
```bash
ls -la /opt/evolution/backup.sh
chmod +x /opt/evolution/backup.sh
```

---

### ❌ Out of memory / Servidor lento

**Ver uso de memoria**:
```bash
free -h
docker stats
```

**Solución temporal** (liberar memoria):
```bash
docker system prune -a
```

**Solución permanente**:
- Upgrade a Droplet con más RAM (4GB recomendado)
- Configurar swap:
  ```bash
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  ```

---

### ❌ PostgreSQL corrupto / No inicia

**Ver logs**:
```bash
docker-compose logs evolution-postgres
```

**Restaurar desde backup**:
```bash
cd /opt/evolution
ls -lh backups/
./restore.sh backups/evolution_backup_YYYYMMDD_HHMMSS.sql.gz
```

---

## 📚 Recursos Adicionales

### Documentación
- **Evolution API**: [https://doc.evolution-api.com](https://doc.evolution-api.com)
- **Docker Compose**: [https://docs.docker.com/compose/](https://docs.docker.com/compose/)
- **Nginx**: [https://nginx.org/en/docs/](https://nginx.org/en/docs/)
- **Let's Encrypt**: [https://letsencrypt.org/docs/](https://letsencrypt.org/docs/)

### Comandos Útiles de Referencia Rápida

```bash
# Estado general
docker-compose ps
docker stats
df -h

# Logs
docker-compose logs -f api
docker-compose logs --tail=100 evolution-postgres

# Reiniciar
docker-compose restart
docker-compose restart api

# Actualizar
docker-compose pull
docker-compose up -d

# Backup manual
/opt/evolution/backup.sh

# Verificar SSL
sudo certbot certificates
sudo certbot renew --dry-run

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/evolution-error.log
```

---

## ✅ Checklist Final

Antes de considerar el despliegue completo:

- [ ] Droplet creado y accesible por SSH
- [ ] Docker y Docker Compose instalados
- [ ] Firewall (UFW) configurado
- [ ] Evolution API corriendo (todos los containers UP)
- [ ] Dominio apuntando a la IP del droplet
- [ ] Nginx configurado como reverse proxy
- [ ] SSL/HTTPS funcionando (Let's Encrypt)
- [ ] Backups automáticos configurados (cron job)
- [ ] Instancia de WhatsApp creada y conectada
- [ ] Webhook configurado y recibiendo mensajes
- [ ] Secrets de Supabase actualizados
- [ ] Bot responde correctamente a mensajes de prueba

---

## 🎯 Próximos Pasos

1. **Monitoreo avanzado**: Instalar Prometheus + Grafana
2. **Alertas**: Configurar notificaciones (Discord, Telegram, email)
3. **CI/CD**: Automatizar deploys con GitHub Actions
4. **Backups offsite**: Sincronizar backups a S3, DigitalOcean Spaces, etc.
5. **Alta disponibilidad**: Configurar múltiples droplets con load balancer

---

**¡Despliegue completo! 🚀**

Si tienes algún problema, revisa la sección de [Troubleshooting](#troubleshooting) o contacta soporte.