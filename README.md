# casino-backend

Backend del **Casino Online** — Experiencia 2 de la asignatura
**Introducción a Herramientas DevOps (ISY1101)**.

API REST en Node.js + Express con PostgreSQL como base de datos.

> **Este repositorio NO incluye `Dockerfile`, `docker-compose.yml`
> ni workflows de GitHub Actions.** Esos artefactos forman parte del
> entregable de la **Evaluación Parcial 2** y deben construirlos los
> estudiantes (frontend + backend + base de datos contenerizados,
> publicados en un registry y desplegados en EC2).

---

## Stack

- Node.js 20 (recomendado correr sobre `node:20-alpine`)
- Express 4
- PostgreSQL 16 (recomendado `postgres:16-alpine` con volumen nombrado)
- JWT para autenticación, bcryptjs para hashes
- `pg` como cliente de Postgres

---

## Estructura

```
casino-backend/
├── src/
│   ├── server.js                ← bootstrap Express + rutas
│   ├── db/
│   │   ├── pool.js              ← Pool de pg + esperarBD()
│   │   └── seed.js              ← usuarios demo (idempotente)
│   ├── middleware/
│   │   └── auth.js              ← JWT firmar / requiereAuth
│   ├── routes/
│   │   ├── auth.js              ← /api/auth/login | register
│   │   ├── users.js             ← /api/usuarios/me, depositar
│   │   ├── games.js             ← /api/juegos/{slots,roulette,blackjack}
│   │   └── transactions.js      ← /api/transacciones (historial)
│   └── games/
│       ├── slots.js
│       ├── roulette.js
│       └── blackjack.js
├── db/
│   └── init.sql                 ← esquema (lo monta Postgres en /docker-entrypoint-initdb.d)
├── package.json
├── .gitignore
└── .env.example
```

---

## Variables de entorno

| Variable        | Default       | Descripción                                   |
|-----------------|---------------|-----------------------------------------------|
| `PORT`          | `3000`        | Puerto HTTP del servidor                      |
| `JWT_SECRET`    | `cambiame`    | Secreto de firma JWT (cambiar en producción)  |
| `JWT_EXPIRES_IN`| `8h`          | Vigencia del token                            |
| `DB_HOST`       | `localhost`   | Host de Postgres (`db` en docker-compose)     |
| `DB_PORT`       | `5432`        | Puerto Postgres                               |
| `DB_USER`       | `casino`      | Usuario Postgres                              |
| `DB_PASSWORD`   | `casino`      | Password Postgres                             |
| `DB_NAME`       | `casino_db`   | Base de datos                                 |
| `CORS_ORIGIN`   | `*`           | Lista CSV de orígenes permitidos              |

---

## Endpoints

### Autenticación

| Método | Ruta                  | Descripción                              |
|--------|-----------------------|------------------------------------------|
| POST   | `/api/auth/register`  | Registro `{ username, email, password }` |
| POST   | `/api/auth/login`     | Login `{ username, password }`           |

### Usuario autenticado (header `Authorization: Bearer <token>`)

| Método | Ruta                                  | Descripción                       |
|--------|---------------------------------------|-----------------------------------|
| GET    | `/api/usuarios/me`                    | Datos del usuario y saldo         |
| POST   | `/api/usuarios/me/depositar`          | `{ monto }` — recarga saldo demo  |
| GET    | `/api/transacciones?limit=50`         | Historial del usuario             |

### Juegos

| Método | Ruta                              | Descripción                                                    |
|--------|-----------------------------------|----------------------------------------------------------------|
| GET    | `/api/juegos`                     | Catálogo (slots, roulette, blackjack)                          |
| POST   | `/api/juegos/slots/jugar`         | `{ apuesta }` → `{ resultado, saldo }`                         |
| POST   | `/api/juegos/roulette/jugar`      | `{ apuestas:[{tipo,valor,monto}] }` → `{ resultado, saldo }`  |
| POST   | `/api/juegos/blackjack/iniciar`   | `{ apuesta }` → `{ sesionId, jugador, banca, ... }`            |
| POST   | `/api/juegos/blackjack/accion`    | `{ sesionId, accion: pedir/plantarse/doblar }`                 |

### Salud

| Método | Ruta       | Descripción                  |
|--------|------------|------------------------------|
| GET    | `/health`  | Estado del servidor + BD     |
| GET    | `/`        | Mensaje de bienvenida        |

---

## Usuarios demo (sembrados al arrancar)

| username   | password    | rol      | saldo inicial |
|------------|-------------|----------|---------------|
| `demo`     | `demo1234`  | jugador  | $5.000        |
| `jugador1` | `demo1234`  | jugador  | $1.000        |
| `admin`    | `admin1234` | admin    | $99.999       |

---

## Cómo correr en local (sin Docker)

Requisitos: Node 20 y un Postgres accesible.

```bash
cp .env.example .env          # ajustar credenciales
npm install                   # genera node_modules (y package-lock.json local, no se commitea)
npm start
# API disponible en http://localhost:3000
```

---

## Conceptos DevOps clave del código

Los siguientes puntos son relevantes para la contenerización y despliegue en EC2.
Busca los comentarios en el código fuente para mayor detalle.

### 1. Configuración por variables de entorno (12-factor App)
Toda la configuración sensible o que cambia entre ambientes (host de la BD,
contraseña, JWT_SECRET, puerto) viene de variables de entorno, nunca
hardcodeada. En Docker se inyectan con `-e`, en `docker-compose.yml` con la
sección `environment:`, y en EC2 se pueden usar secretos de AWS.

### 2. Endpoint `/health` y Docker HEALTHCHECK
`GET /health` consulta la BD y responde `{ status: "ok" }` o `503`.
Docker lo usa en el `HEALTHCHECK` del `Dockerfile`; los Load Balancers de AWS
lo usan para enrutar tráfico solo hacia instancias/contenedores sanos.
Deben configurar este endpoint como HEALTHCHECK en el Dockerfile del backend
y como health check en el servicio de docker-compose.

### 3. Binding a `0.0.0.0`
El servidor escucha en `0.0.0.0` (todas las interfaces), no en `localhost`.
Dentro de un contenedor, `localhost` solo aceptaría conexiones originadas
dentro del mismo contenedor; `0.0.0.0` permite que el host (EC2) y otros
contenedores puedan acceder.

### 4. Reintentos de conexión a la BD (`esperarBD`)
Cuando `docker-compose up` levanta varios servicios a la vez, el backend
puede arrancar antes de que Postgres esté listo. `esperarBD()` reintenta
hasta 30 veces con 2 s de espera. La solución definitiva es combinar esto
con `depends_on: condition: service_healthy` y un `healthcheck` en el
servicio `db` usando `pg_isready`.

### 5. Inicialización del esquema (`db/init.sql`)
Postgres ejecuta los archivos `.sql` en `/docker-entrypoint-initdb.d/`
**solo si el volumen está vacío** (primer arranque). En reinicios
posteriores el script no se vuelve a ejecutar. Por eso todas las
sentencias DDL usan `IF NOT EXISTS`. Deben montar este archivo en el
contenedor de la BD usando la sección `volumes:` del docker-compose.yml.

### 6. Seed idempotente
`seed.js` inserta usuarios demo al arrancar el backend usando
`ON CONFLICT DO NOTHING`, por lo que es seguro ejecutarlo en cada
reinicio del contenedor sin riesgo de duplicar datos ni fallar.

### 7. Pool de conexiones
`pg.Pool` mantiene hasta 10 conexiones abiertas simultáneamente.
En producción este valor debe ajustarse según la instancia RDS/Postgres
y la cantidad de réplicas del contenedor.

---

## Cómo lo van a contenerizar (EP2)

El docente espera que ustedes:

1. Construyan un **Dockerfile multi-stage** (`builder` con `npm install`,
   `runtime` `node:20-alpine` con usuario no root).
2. Definan en el `docker-compose.yml` los servicios `db`, `backend`
   (y agreguen el `frontend`) con:
   - `pg_data` como **named volume** para `/var/lib/postgresql/data`.
   - `./casino-backend/db/init.sql` montado en `/docker-entrypoint-initdb.d/`
     (recuerden: solo se ejecuta si el volumen está vacío).
   - `depends_on` con `condition: service_healthy` y un `healthcheck`
     en `db` (`pg_isready`).
   - Variables de entorno **inyectadas por compose**, sin hard-codear.
3. Configuren workflows en `.github/workflows/` que hagan
   `build → push (ECR) → deploy` en EC2 al hacer push a la rama
   correspondiente (en el **Ejercicio 2.5** se usa `main`; en la
   **EP2** la pauta oficial pide la rama `deploy`).

Lean la pauta oficial (`EP2_Instrucciones y Pauta_Encargo_Estudiante.pdf`)
para los criterios completos.

---

## Repositorio del frontend

[`casino-frontend`](../casino-frontend)
