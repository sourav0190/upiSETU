### 1. Spring Web (`spring-boot-starter-web`)
- **Purpose:** Used to develop web applications and RESTful APIs.
- **Why we use it:** It provides an embedded Apache Tomcat server to run the application without requiring a separately installed web server. It also supports annotations such as `@RestController`, `@GetMapping`, and `@PostMapping` to handle HTTP requests and responses.

### 2. Spring Data JPA (`spring-boot-starter-data-jpa`)
- **Purpose:** Simplifies database operations using Java objects.
- **Why we use it:** It provides an abstraction over database access and uses Hibernate as the default JPA implementation. It allows us to perform CRUD (Create, Read, Update, Delete) operations through Java interfaces and entities, reducing the need to write repetitive SQL queries.

### 3. H2 Database (`com.h2database:h2`)
- **Purpose:** Provides a lightweight relational database for storing and retrieving data.
- **Why we use it:** H2 can run as an in-memory database, storing data in RAM while the application is running. This makes the project easy to set up and test without requiring a separate MySQL or PostgreSQL installation. In-memory data is generally lost when the application stops unless persistence is configured.

### 4. Frontend Architecture: Static Web Client (Decoupled SPA)

Why we DON'T need Thymeleaf: Instead of server-side rendering, our backend acts as a pure REST API.
How it works: We place standard index.html, style.css, and app.js in src/main/resources/static/. Spring Boot serves them automatically. The frontend communicates with the Java backend asynchronously using standard JavaScript fetch() calls.