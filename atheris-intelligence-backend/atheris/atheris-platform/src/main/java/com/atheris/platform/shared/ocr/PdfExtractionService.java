package com.atheris.platform.shared.ocr;

import lombok.extern.slf4j.Slf4j;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import java.awt.image.BufferedImage;
import java.io.IOException;

@Service
@Slf4j
public class PdfExtractionService {

    private static final int MIN_TEXT_LENGTH = 100;

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
        String tessData = System.getenv("TESSDATA_PREFIX");
        if (tessData == null || !new java.io.File(tessData).exists()) {
            log.warn("TESSDATA_PREFIX not set or path missing — skipping Tesseract OCR");
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
}
