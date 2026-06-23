package com.atheris.platform.modules.regulators.strategy;

import com.atheris.common.Constants;
import com.atheris.platform.modules.regulators.entity.Regulator;
import com.microsoft.playwright.*;
import com.microsoft.playwright.options.WaitUntilState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
@RequiredArgsConstructor
public class PlaywrightHeadlessStrategy {

    private final PlaywrightBrowserPool browserPool;

    public List<PdfLink> findPdfLinks(Regulator regulator, int startPage) {
        List<PdfLink> links = new ArrayList<>();
        int maxPages = regulator.getMaxPagesPerRun() != null ? regulator.getMaxPagesPerRun() : 3;
        String currentUrl = regulator.getPublicationPageUrl();
        int pageCount = 0;

        try (BrowserContext context = browserPool.newContext(regulator)) {
            Page page = context.newPage();

            // Block images, fonts, media — only need HTML
            page.route(Constants.PW_BLOCK_RESOURCES,
                route -> route.abort());

            while (currentUrl != null && pageCount < maxPages) {
                log.info("[Playwright] Scraping page {} for {}: {}",
                    pageCount + 1, regulator.getAbbreviation(), currentUrl);
                try {
                    page.navigate(currentUrl, new Page.NavigateOptions()
                        .setWaitUntil(WaitUntilState.NETWORKIDLE)
                        .setTimeout(30_000));

                    if (regulator.getPdfLinkSelector() != null
                            && !regulator.getPdfLinkSelector().isBlank()) {
                        page.waitForSelector(regulator.getPdfLinkSelector(),
                            new Page.WaitForSelectorOptions().setTimeout(10_000));
                    }

                    Document doc = Jsoup.parse(page.content(), currentUrl);
                    links.addAll(extractPdfLinks(doc, regulator, currentUrl));

                    currentUrl = regulator.getPaginationEnabled()
                        ? findNextPageUrl(doc, regulator, currentUrl, page) : null;

                    pageCount++;
                    if (currentUrl != null) Thread.sleep(2_000);

                } catch (PlaywrightException e) {
                    log.error("[Playwright] Error on {}: {}", currentUrl, e.getMessage());
                    break;
                }
            }
            // Download PDFs within the same browser context (preserves Cloudflare cookies)
            for (PdfLink link : links) {
                try {
                    Page pdfPage = context.newPage();
                    Response resp = pdfPage.waitForResponse(
                        r -> r.url().equals(link.getUrl()),
                        () -> pdfPage.navigate(link.getUrl(), new Page.NavigateOptions()
                            .setTimeout(60_000).setWaitUntil(WaitUntilState.NETWORKIDLE)));
                    String ct = resp.headers().getOrDefault("content-type", "").toLowerCase();
                    if (ct.contains("pdf") || ct.contains("octet-stream"))
                        link.setPdfBytes(resp.body());
                    else
                        log.warn("[Playwright] {} returned {}", link.getUrl(), ct);
                    pdfPage.close();
                } catch (Exception e) {
                    log.warn("[Playwright] Failed to download {}: {}", link.getUrl(), e.getMessage());
                }
            }
            page.close();
        } catch (Exception e) {
            log.error("[Playwright] Session failed for {}: {}",
                regulator.getAbbreviation(), e.getMessage());
        }
        return links;
    }

    private List<PdfLink> extractPdfLinks(Document doc, Regulator regulator, String pageUrl) {
        List<PdfLink> links = new ArrayList<>();
        Elements elements = regulator.getPdfLinkSelector() != null
            ? doc.select(regulator.getPdfLinkSelector())
            : doc.select("a[href]");
        for (Element el : elements) {
            String href = el.absUrl("href");
            if (href.isEmpty() || !isPdfUrl(href)) continue;
            links.add(PdfLink.builder()
                .url(href.split("[?#]")[0])
                .title(el.text().trim().isEmpty() ? el.attr("title") : el.text().trim())
                .discoveredOnPage(pageUrl)
                .build());
        }
        return links;
    }

    private String findNextPageUrl(Document doc, Regulator regulator,
                                    String currentUrl, Page page) {
        String strategy = regulator.getPaginationStrategy();
        if (strategy == null) return null;
        return switch (strategy) {
            case Constants.PAGINATION_NEXT_BUTTON -> {
                if (regulator.getPaginationSelector() == null) yield null;
                Element next = doc.selectFirst(regulator.getPaginationSelector());
                if (next == null) yield null;
                String url = next.absUrl("href");
                yield (url.isEmpty() || url.equals(currentUrl)) ? null : url;
            }
            case Constants.PAGINATION_PAGE_PARAM -> {
                Matcher m = Pattern.compile("page=(\\d+)").matcher(currentUrl);
                int pageNum = m.find() ? Integer.parseInt(m.group(1)) : 1;
                yield currentUrl.replaceAll("page=\\d+", "page=" + (pageNum + 1));
            }
            case Constants.PAGINATION_YEAR_FOLDERS -> {
                Matcher m = Pattern.compile("/(20\\d{2})/").matcher(currentUrl);
                if (!m.find()) yield null;
                int year = Integer.parseInt(m.group(1));
                int startYear = regulator.getHistoricalStartYear() != null
                    ? regulator.getHistoricalStartYear() : 2022;
                yield year <= startYear ? null
                    : currentUrl.replace("/" + year + "/", "/" + (year - 1) + "/");
            }
            default -> null;
        };
    }

    private boolean isPdfUrl(String url) {
        String lower = url.toLowerCase();
        return lower.endsWith(".pdf") || lower.contains(".pdf?");
    }
}
