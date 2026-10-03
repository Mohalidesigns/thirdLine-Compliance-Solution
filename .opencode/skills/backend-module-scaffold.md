# backend-module-scaffold

Reusable skill for building Spring Boot backend modules following the Atheris pattern.

## Module Structure

Every backend module follows this structure:

```
modules/{entity}/
  entity/{Entity}.java              — JPA @Entity with Lombok
  repository/{Entity}Repository.java — Spring Data JPA
  service/{Entity}Service.java      — Business logic
  controller/{Entity}Controller.java — Thin REST controller
  dto/
    {Entity}Dto.java                — Response DTO
    Create{Entity}Request.java      — Create request body
    Update{Entity}Request.java      — Update request body (if needed)
```

## Entity Pattern

```java
@Entity
@Table(name = "{table_name}")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class {Entity} {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long {entity}Id;

    @Column(nullable = false)
    private Long tenantId;

    // Fields with @Builder.Default for initialized values
    @Builder.Default private String status = "active";
    @Builder.Default private Instant createdAt = Instant.now();

    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
```

### Rules
- Always use `@Builder.Default` on initialized fields
- Always include `tenantId` for multi-tenant modules
- Use `@PrePersist` / `@PreUpdate` for timestamps
- `@JsonIgnoreProperties(ignoreUnknown = true)` on DTOs
- Use `java.time.Instant` for timestamps, `java.time.LocalDate` for dates

## Repository Pattern

```java
public interface {Entity}Repository extends JpaRepository<{Entity}, Long> {
    // Simple lookups — use findBy methods
    List<{Entity}> findByTenantIdAndStatus(Long tenantId, String status);
    Optional<{Entity}> findBy{Entity}IdAndTenantId(Long id, Long tenantId);

    // Complex joins — use native @Query
    @Query(value = "SELECT ... FROM {table} WHERE tenant_id = :tenantId", nativeQuery = true)
    List<Object[]> findComplexData(@Param("tenantId") Long tenantId);

    // Filtering — use JpaSpecificationExecutor
    // @Query for aggregations
    @Query("SELECT COUNT(e) FROM {Entity} e WHERE e.tenantId = :tenantId AND e.status = :status")
    long countByTenantIdAndStatus(@Param("tenantId") Long tenantId, @Param("status") String status);
}
```

### Rules
- `findBy` for simple lookups (no JPQL)
- Native `@Query` for complex joins and aggregations
- `JpaSpecificationExecutor` for multi-filter list endpoints
- Avoid N+1 — fetch related data in single query or `@EntityGraph`
- Never use JPQL unless absolutely necessary — prompt user for approval first

## Service Pattern

```java
@Service @Slf4j @RequiredArgsConstructor
public class {Entity}Service {
    private final {Entity}Repository repo;
    private final TenantIdentityService tenantIdentity;
    private final AuditService audit;

    @PersistenceContext private EntityManager em;

    @Transactional
    public {Entity}Dto create(Create{Entity}Request req, Integer userId) {
        Long tenantId = tenantIdentity.currentTenantId();
        {Entity} entity = {Entity}.builder()
            .tenantId(tenantId)
            // map fields from request
            .build();
        entity = repo.save(entity);
        audit.log(userId, "{entity}_created", "{entity}", entity.get{Entity}Id(), Map.of());
        return toDto(entity);
    }

    // All @Transactional catch blocks MUST follow this pattern:
    @Transactional
    public void riskyOperation() {
        try {
            // logic
        } catch (Throwable e) {
            log.error("Operation failed: {}", e.getMessage(), e);
            try { em.clear(); } catch (Throwable ignored) {}
            try { TransactionAspectSupport.currentTransactionStatus().setRollbackOnly(); } catch (Throwable ignored) {}
            throw e instanceof RuntimeException ? (RuntimeException) e : new RuntimeException(e);
        }
    }
}
```

### Rules
- `@RequiredArgsConstructor` for dependency injection
- Use `tenantIdentity.currentTenantId()` — never hardcode tenant ID
- All `@Transactional` catch blocks: `em.clear()` + `setRollbackOnly()` + catch `Throwable`
- Audit log every mutation: `audit.log(userId, action, entity, id, metadata)`
- Validate inputs server-side — never trust frontend

## Controller Pattern

```java
@RestController
@RequestMapping("/api/v1/{entities}")
@RequiredArgsConstructor
public class {Entity}Controller {
    private final {Entity}Service service;

    @GetMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<Page<{Entity}Dto>> list(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String risk,
            Pageable p) {
        return ResponseEntity.ok(service.list(q, risk, p));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO','ANALYST')")
    public ResponseEntity<{Entity}Dto> detail(@PathVariable Long id) {
        return ResponseEntity.ok(service.detail(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('TENANT_ADMIN','CCO')")
    public ResponseEntity<{Entity}Dto> create(@RequestBody Create{Entity}Request req,
                                              @AuthenticationPrincipal User u) {
        return ResponseEntity.ok(service.create(req, u.getUserId()));
    }
}
```

### Rules
- Thin controllers — delegate everything to service
- `@PreAuthorize` on every endpoint
- `@AuthenticationPrincipal User u` for audit trail
- Return DTOs, never entities
- Use `Pageable` for list endpoints

## DTO Pattern

```java
@Data @Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class {Entity}Dto {
    private Long {entity}Id;
    private String name;
    private String status;
    @Builder.Default private List<String> tags = List.of();
    private Instant createdAt;
}
```

### Rules
- `@JsonIgnoreProperties(ignoreUnknown = true)` on all DTOs
- `@Builder.Default` on initialized fields
- Use `List.of()` for empty list defaults
- DTOs mirror what the frontend needs — no internal fields

## Flyway Migration

- Edit existing migration files in place when modifying tables
- Only create new `V<next>` files for genuinely new tables
- Use `BIGINT` for IDs, `TEXT` for long strings, `VARCHAR(n)` for bounded strings
- `JSONB` for flexible structured data
- Always include `tenant_id` column for multi-tenant tables
- Run `mvn org.flywaydb:flyway-maven-plugin:10.12.0:repair` after editing migrations

## Compilation Check

After any backend change, run:
```bash
mvn compile -pl atheris-compliance-tenant-backend -am -q
```
or for intel:
```bash
mvn compile -pl atheris-compliance-intelligence-backend -am -q
```
