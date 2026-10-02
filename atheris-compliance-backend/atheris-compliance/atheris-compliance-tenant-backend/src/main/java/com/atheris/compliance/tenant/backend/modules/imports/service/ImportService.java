package com.atheris.compliance.tenant.backend.modules.imports.service;

import com.atheris.compliance.tenant.backend.modules.imports.dto.*;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportBatch;
import com.atheris.compliance.tenant.backend.modules.imports.entity.ImportRowData;
import com.atheris.compliance.tenant.backend.modules.imports.handler.ImportHandler;
import com.atheris.compliance.tenant.backend.modules.imports.repository.ImportBatchRepository;
import com.atheris.compliance.tenant.backend.shared.exception.ApiException;
import com.atheris.compliance.tenant.backend.shared.tenant.TenantIdentityService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.interceptor.TransactionAspectSupport;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Template-based bulk import: template download, preview (parse + validate + dedup, stored as a
 * {@code previewed} batch, nothing written to the register) and commit (valid rows persisted in one
 * transaction). Entity specifics live in {@link ImportHandler} beans.
 */
@Service
@Slf4j
public class ImportService {

    private final Map<String, ImportHandler> handlers;
    private final ImportBatchRepository batches;
    private final TenantIdentityService tenantIdentity;

    @PersistenceContext
    private EntityManager em;

    public ImportService(List<ImportHandler> handlers, ImportBatchRepository batches,
                         TenantIdentityService tenantIdentity) {
        this.handlers = handlers.stream().collect(Collectors.toMap(ImportHandler::entityType, Function.identity()));
        this.batches = batches;
        this.tenantIdentity = tenantIdentity;
    }

    // ------------------------------------------------------------------ template

    public ImportFile template(String type) {
        ImportHandler h = handler(type);
        return new ImportFile(h.entityType() + "-import-template.xlsx", ImportWorkbooks.template(h));
    }

    // ------------------------------------------------------------------ preview

    @Transactional
    public ImportPreviewResponse preview(String type, MultipartFile file, Integer userId, String userName) {
        ImportHandler h = handler(type);
        List<ImportRowData> rows = ImportWorkbooks.parse(file, h);
        try {
            h.validate(rows);
            ImportBatch batch = ImportBatch.builder()
                .tenantId(tenantIdentity.currentTenantId())
                .entityType(h.entityType())
                .fileName(file.getOriginalFilename())
                .status(ImportBatch.STATUS_PREVIEWED)
                .rows(rows)
                .createdByUserId(userId)
                .createdByName(userName)
                .createdAt(Instant.now())
                .build();
            applyCounts(batch);
            batch = batches.save(batch);
            return toPreview(batch);
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    // ------------------------------------------------------------------ commit

    @Transactional
    public ImportBatchSummary commit(Long batchId, Integer userId) {
        ImportBatch batch = batches.findWithLockByBatchId(batchId)
            .orElseThrow(() -> ApiException.notFound("Import batch not found: " + batchId));
        if (!ImportBatch.STATUS_PREVIEWED.equals(batch.getStatus()))
            throw ApiException.conflict("already_committed", "Import batch " + batchId + " has already been committed");
        ImportHandler h = handler(batch.getEntityType());
        try {
            List<ImportRowData> rows = batch.getRows();
            // persist() re-validates first, so duplicates created since the preview are skipped
            int imported = h.persist(rows, userId, batchId);
            batch.setRows(rows);
            applyCounts(batch);
            batch.setImportedRows(imported);
            batch.setStatus(ImportBatch.STATUS_COMMITTED);
            batch.setCommittedAt(Instant.now());
            batch = batches.save(batch);
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { h.afterCommit(); }
            });
            log.info("Import batch {} committed: {} {} imported", batchId, imported, h.entityType());
            return toSummary(batch);
        } catch (RuntimeException e) {
            rollback();
            throw e;
        }
    }

    // ------------------------------------------------------------------ error report / history

    @Transactional(readOnly = true)
    public ImportFile errorReport(Long batchId) {
        ImportBatch batch = batches.findById(batchId)
            .orElseThrow(() -> ApiException.notFound("Import batch not found: " + batchId));
        ImportHandler h = handler(batch.getEntityType());
        List<ImportRowData> invalid = batch.getRows() == null ? List.of() : batch.getRows().stream()
            .filter(r -> ImportRowData.INVALID.equals(r.getResult())).toList();
        return new ImportFile(h.entityType() + "-import-errors-" + batchId + ".xlsx",
            ImportWorkbooks.errorReport(h, invalid));
    }

    @Transactional(readOnly = true)
    public List<ImportBatchSummary> listBatches(String type) {
        List<ImportBatch> list = type == null || type.isBlank()
            ? batches.findTop50ByOrderByCreatedAtDesc()
            : batches.findTop50ByEntityTypeOrderByCreatedAtDesc(handler(type).entityType());
        return list.stream().map(ImportService::toSummary).toList();
    }

    // ------------------------------------------------------------------ helpers

    private ImportHandler handler(String type) {
        ImportHandler h = type == null ? null : handlers.get(type.trim().toLowerCase());
        if (h == null) throw ApiException.badRequest("unsupported_import_type", "Unsupported import type: " + type);
        return h;
    }

    private void rollback() {
        try {
            TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        } catch (Throwable ignored) {
            // no active transaction
        }
        em.clear();
    }

    private static void applyCounts(ImportBatch b) {
        List<ImportRowData> rows = b.getRows() == null ? List.of() : b.getRows();
        b.setTotalRows(rows.size());
        b.setValidRows((int) rows.stream().filter(r -> ImportRowData.VALID.equals(r.getResult())).count());
        b.setInvalidRows((int) rows.stream().filter(r -> ImportRowData.INVALID.equals(r.getResult())).count());
        b.setDuplicateRows((int) rows.stream().filter(r -> ImportRowData.DUPLICATE.equals(r.getResult())).count());
    }

    private static ImportPreviewResponse toPreview(ImportBatch b) {
        List<ImportRowResult> rows = b.getRows().stream()
            .map(r -> ImportRowResult.builder()
                .rowNumber(r.getRowNumber())
                .result(r.getResult())
                .errors(r.getErrors() != null ? r.getErrors() : List.of())
                .primary(r.getPrimary())
                .secondary(r.getSecondary())
                .context(r.getContext())
                .risk(r.getRisk())
                .build())
            .toList();
        return ImportPreviewResponse.builder()
            .batchId(b.getBatchId())
            .entityType(b.getEntityType())
            .fileName(b.getFileName())
            .status(b.getStatus())
            .totalRows(b.getTotalRows())
            .validRows(b.getValidRows())
            .invalidRows(b.getInvalidRows())
            .duplicateRows(b.getDuplicateRows())
            .rows(rows)
            .build();
    }

    private static ImportBatchSummary toSummary(ImportBatch b) {
        return ImportBatchSummary.builder()
            .batchId(b.getBatchId())
            .entityType(b.getEntityType())
            .fileName(b.getFileName())
            .status(b.getStatus())
            .totalRows(nz(b.getTotalRows()))
            .validRows(nz(b.getValidRows()))
            .invalidRows(nz(b.getInvalidRows()))
            .duplicateRows(nz(b.getDuplicateRows()))
            .importedRows(nz(b.getImportedRows()))
            .createdAt(b.getCreatedAt())
            .committedAt(b.getCommittedAt())
            .createdByName(b.getCreatedByName())
            .build();
    }

    private static int nz(Integer i) { return i != null ? i : 0; }
}
