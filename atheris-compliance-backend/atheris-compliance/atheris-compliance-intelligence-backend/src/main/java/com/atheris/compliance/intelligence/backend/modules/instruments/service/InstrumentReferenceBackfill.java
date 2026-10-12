package com.atheris.compliance.intelligence.backend.modules.instruments.service;

import com.atheris.compliance.intelligence.backend.modules.instruments.entity.Instrument;
import com.atheris.compliance.intelligence.backend.modules.instruments.repository.InstrumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * One-time, idempotent backfill: give a generated reference number to any instrument that
 * still has none. New instruments are covered at insert time by
 * {@link Instrument#assignGeneratedReference()}; this closes the gap for rows created before
 * that hook existed (e.g. an already-populated database that was not reseeded). Runs once on
 * startup and is a cheap no-op when everything already has a reference.
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class InstrumentReferenceBackfill implements ApplicationRunner {

    private final InstrumentRepository instruments;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        List<Instrument> missing = new ArrayList<>();
        missing.addAll(instruments.findBySourceReferenceNumberIsNull());
        missing.addAll(instruments.findBySourceReferenceNumber(""));
        if (missing.isEmpty()) return;

        for (Instrument inst : missing) {
            String prefix = "toolkit_seed".equals(inst.getUploadSource()) ? "TKL" : "GEN";
            inst.setSourceReferenceNumber(String.format("%s-%04d", prefix, inst.getInstrumentId()));
        }
        instruments.saveAll(missing);
        log.info("[InstrumentRefBackfill] Assigned a generated reference number to {} instrument(s)", missing.size());
    }
}
