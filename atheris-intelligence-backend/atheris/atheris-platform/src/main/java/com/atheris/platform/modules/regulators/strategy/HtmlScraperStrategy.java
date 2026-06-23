package com.atheris.platform.modules.regulators.strategy;

import com.atheris.common.Constants;
import com.atheris.platform.modules.regulators.entity.Regulator;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;

@Component
@Slf4j
public class HtmlScraperStrategy {

    public List<PdfLink> findPdfLinks(Regulator regulator, int startPage) {
        List<PdfLink> links = new ArrayList<>();
        String pageUrl = regulator.getPublicationPageUrl();
        int maxPages = regulator.getMaxPagesPerRun() != null ? regulator.getMaxPagesPerRun() : 3;
        int pageCount = 0;

        while (pageUrl != null && pageCount < maxPages) {
            try {
                log.info("[HTML] Scraping page {} for {}: {}", pageCount + 1,
                    regulator.getAbbreviation(), pageUrl);

                Document doc = Jsoup.connect(pageUrl)
                    .userAgent(Constants.USER_AGENT)
                    .timeout(30_000)
                    .followRedirects(true)
                    .get();

                links.addAll(extractPdfLinks(doc, regulator, pageUrl));

                pageUrl = regulator.getPaginationEnabled()
                    ? findNextPageUrl(doc, regulator, pageUrl) : null;

                pageCount++;
                if (pageUrl != null) Thread.sleep(2_000); // polite delay

            } catch (Exception e) {
                log.error("[HTML] Error scraping {}: {}", pageUrl, e.getMessage());
                break;
            }
        }
        return links;
    }

    private List<PdfLink> extractPdfLinks(Document doc, Regulator regulator, String pageUrl) {
        List<PdfLink> links = new ArrayList<>();
        Elements elements = regulator.getPdfLinkSelector() != null && !regulator.getPdfLinkSelector().isBlank()
            ? doc.select(regulator.getPdfLinkSelector())
            : doc.select("a[href]");

        for (Element el : elements) {
            String href = el.absUrl("href");
            if (href.isEmpty() || !isPdfUrl(href)) continue;
            links.add(PdfLink.builder()
                .url(normaliseUrl(href))
                .title(extractTitle(el, href))
                .discoveredOnPage(pageUrl)
                .build());
        }
        return links;
    }

    private String findNextPageUrl(Document doc, Regulator regulator, String current) {
        if (regulator.getPaginationSelector() == null) return null;
        Element next = doc.selectFirst(regulator.getPaginationSelector());
        if (next == null) return null;
        String url = next.absUrl("href");
        return (url.isEmpty() || url.equals(current)) ? null : url;
    }

    private boolean isPdfUrl(String url) {
        String lower = url.toLowerCase();
        return lower.endsWith(".pdf") || lower.contains(".pdf?")
            || lower.contains("/pdf/") || lower.contains("download=pdf");
    }

    private String extractTitle(Element el, String href) {
        String text = el.text().trim();
        if (!text.isEmpty() && text.length() > 5) return text;
        String title = el.attr("title").trim();
        if (!title.isEmpty()) return title;
        String filename = href.substring(href.lastIndexOf('/') + 1)
            .split("[?#]")[0].replace(".pdf", "").replace("-", " ").replace("_", " ");
        return filename.isEmpty() ? "Untitled" : filename;
    }

    private String normaliseUrl(String url) {
        return url.split("[?#]")[0].trim();
    }
}
