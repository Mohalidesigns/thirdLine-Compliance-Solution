package com.atheris.compliance.tenant.backend.modules.imports.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * One uploaded import file. Created at preview (status {@code previewed}) with every parsed row,
 * its raw values and its validation result stored in {@code rows}; flipped to {@code committed}
 * once its valid rows have been written to the register.
 */
@Entity
@Table(name = "import_batches")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ImportBatch {
    public static final String STATUS_PREVIEWED = "previewed";
    public static final String STATUS_COMMITTED = "committed";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long batchId;
    private Long tenantId;
    @Column(nullable = false) private String entityType;
    private String fileName;
    @Builder.Default private String status = STATUS_PREVIEWED;
    @Builder.Default private Integer totalRows = 0;
    @Builder.Default private Integer validRows = 0;
    @Builder.Default private Integer invalidRows = 0;
    @Builder.Default private Integer duplicateRows = 0;
    @Builder.Default private Integer importedRows = 0;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "rows", columnDefinition = "jsonb")
    @Builder.Default private List<ImportRowData> rows = new ArrayList<>();
    private Integer createdByUserId;
    @Column(columnDefinition = "text") private String createdByName;
    private Instant createdAt;
    private Instant committedAt;

    @PrePersist void onCreate() { if (createdAt == null) createdAt = Instant.now(); }
}
