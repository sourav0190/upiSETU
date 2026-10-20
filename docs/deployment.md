# MeshPay — Deployment & Operations Guide

## 1. Quick Start (Zero-Setup Local Development)

MeshPay is configured out-of-the-box to run with zero external software installations using an embedded in-memory H2 database.

### Prerequisites
- Java Development Kit: **JDK 17 or 21+** (Eclipse Adoptium Temurin LTS recommended)
- Build Tool: **Apache Maven 3.8+** or included `./mvnw` wrapper

### Step 1: Start the Backend & Web Application
Open PowerShell or your preferred terminal in the workspace directory and execute:

```powershell
mvn clean spring-boot:run
```

*(Alternatively, on Linux/macOS: `./mvnw spring-boot:run` or on Windows: `.\mvnw.cmd spring-boot:run`)*

### Step 2: Access the Application
- **Modern Fintech Client (Google Pay / PhonePe Experience):**  
  [http://localhost:8080/](http://localhost:8080/)
- **Classic Developer Diagnostic Console:**  
  [http://localhost:8080/classic](http://localhost:8080/classic)
- **H2 In-Memory Database Browser:**  
  [http://localhost:8080/h2-console](http://localhost:8080/h2-console)  
  *(JDBC URL: `jdbc:h2:mem:upimesh`, Username: `sa`, Password: empty)*

---

## 2. Production PostgreSQL Deployment

To deploy MeshPay with durable PostgreSQL persistence:

### 1. `docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: meshpay-postgres
    environment:
      POSTGRES_DB: meshpay_db
      POSTGRES_USER: meshpay_user
      POSTGRES_PASSWORD: meshpay_secret_password
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

  meshpay-backend:
    build: .
    container_name: meshpay-app
    depends_on:
      - postgres
    environment:
      SPRING_PROFILES_ACTIVE: postgres
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/meshpay_db
      SPRING_DATASOURCE_USERNAME: meshpay_user
      SPRING_DATASOURCE_PASSWORD: meshpay_secret_password
    ports:
      - "8080:8080"
    restart: unless-stopped

volumes:
  pgdata:
```

### 2. Run with Docker Compose
```bash
docker compose up -d
```

---

## 3. Environment Variables & Properties

| Variable | Property Key | Default | Description |
|---|---|---|---|
| `SERVER_PORT` | `server.port` | `8080` | HTTP port on which Spring Boot listens |
| `SPRING_PROFILES_ACTIVE` | `spring.profiles.active` | `default` | Active profile (`default` for H2, `postgres` for PostgreSQL) |
| `IDEMPOTENCY_TTL` | `upi.mesh.idempotency-ttl-seconds` | `86400` | Retention window for deduplicating packet hashes (1 day) |
| `PACKET_MAX_AGE` | `upi.mesh.packet-max-age-seconds` | `86400` | Freshness replay protection window (1 day) |
