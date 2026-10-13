package com.atheris.compliance.intelligence.backend.shared.ocr;

import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;

@Service
@Slf4j
public class PdfExtractionService {

    private static final int MIN_TEXT_LENGTH = 100;

    /** Common tessdata locations (Homebrew Intel/ARM, Linux distro packages). */
    private static final String[] DEFAULT_TESSDATA_PATHS = {
        "/opt/homebrew/share/tessdata",
        "/usr/local/share/tessdata",
        "/usr/share/tessdata",
        "/usr/share/tesseract-ocr/tessdata",
        "/opt/homebrew/share/tesseract-ocr/tessdata",
        "/usr/local/share/tesseract-ocr/tessdata"
    };

    /** Common native libtesseract locations (JNA searches these). */
    private static final String[] DEFAULT_LIBRARY_PATHS = {
        "/opt/homebrew/lib",
        "/usr/local/lib",
        "/usr/lib",
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib/aarch64-linux-gnu"
    };

    /**
     * Tess4J loads the native libtesseract via JNA, which does not search the Homebrew
     * lib directory by default. Add the existing candidates to {@code jna.library.path}
     * before Tess4J is first initialised so OCR works without external JVM flags.
     */
    @PostConstruct
    void configureJnaLibraryPath() {
        StringBuilder sb = new StringBuilder();
        String existing = System.getProperty("jna.library.path");
        if (existing != null && !existing.isBlank()) sb.append(existing);
        for (String dir : DEFAULT_LIBRARY_PATHS) {
            if (new File(dir).isDirectory()) {
                if (sb.length() > 0) sb.append(File.pathSeparatorChar);
                sb.append(dir);
            }
        }
        if (sb.length() > 0) {
            System.setProperty("jna.library.path", sb.toString());
            log.debug("jna.library.path = {}", sb);
        }
    }

    /**
     * Extract text from a PDF.
     * Tries PDFBox first (fast, free, works for 95% of Nigerian regulator PDFs).
     * Falls back to Tesseract OCR for scanned images.
     */
    public String extractText(byte[] pdfBytes) {
        String text = extractWithPdfBox(pdfBytes);
        if (text.length() >= MIN_TEXT_LENGTH) {
            log.info("PDFBox extracted {} chars", text.length());
            return text;
        }
        log.warn("PDFBox returned {} chars — falling back to Tesseract OCR", text.length());
        return extractWithTesseract(pdfBytes);
    }

    public String extractWithPdfBox(byte[] pdfBytes) {
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            return stripper.getText(doc).trim();
        } catch (IOException e) {
            log.error("PDFBox extraction failed: {}", e.getMessage());
            return "";
        }
    }

    public String extractWithTesseract(byte[] pdfBytes) {
        String tessData = resolveTessDataPath();
        if (tessData == null) {
            log.warn("No Tesseract tessdata directory found (set TESSDATA_PREFIX or install tesseract) — skipping Tesseract OCR");
            return "";
        }
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            Tesseract tesseract = new Tesseract();
            tesseract.setDatapath(tessData);
            tesseract.setLanguage("eng");
            StringBuilder sb = new StringBuilder();
            PDFRenderer renderer = new PDFRenderer(doc);
            int totalPages = doc.getNumberOfPages();
            for (int i = 0; i < totalPages; i++) {
                BufferedImage img;
                try {
                    img = renderer.renderImageWithDPI(i, 200);
                } catch (Exception e) {
                    log.warn("Failed to render page {}/{}: {}", i + 1, totalPages, e.getMessage());
                    continue;
                }
                int w = img.getWidth(), h = img.getHeight();
                if (w > 4000 || h > 4000) {
                    log.warn("Page {}/{} too large ({}x{}), skipping", i + 1, totalPages, w, h);
                    continue;
                }
                try {
                    sb.append(tesseract.doOCR(img)).append("\n\n");
                } catch (Throwable e) {
                    log.warn("Tesseract OCR failed on page {}/{}: {}", i + 1, totalPages, e.getMessage());
                }
                log.debug("OCR page {}/{}", i + 1, totalPages);
            }
            return sb.toString().trim();
        } catch (IOException e) {
            log.error("PDF loading failed: {}", e.getMessage());
            throw new RuntimeException("PDF text extraction failed", e);
        }
    }

    private String resolveTessDataPath() {
        String env = System.getenv("TESSDATA_PREFIX");
        if (env != null && !env.isBlank()) {
            File dir = new File(env);
            if (hasLangData(dir)) return dir.getPath();
            File nested = new File(dir, "tessdata");
            if (hasLangData(nested)) return nested.getPath();
        }
        for (String path : DEFAULT_TESSDATA_PATHS) {
            File dir = new File(path);
            if (hasLangData(dir)) {
                log.info("Using Tesseract tessdata at {}", dir.getPath());
                return dir.getPath();
            }
        }
        return null;
    }

    private boolean hasLangData(File dir) {
        return dir.isDirectory() && new File(dir, "eng.traineddata").isFile();
    }
}
