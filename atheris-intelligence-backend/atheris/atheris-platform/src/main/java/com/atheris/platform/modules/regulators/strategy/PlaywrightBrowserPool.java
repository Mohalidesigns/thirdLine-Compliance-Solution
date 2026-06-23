package com.atheris.platform.modules.regulators.strategy;

import com.atheris.common.Constants;
import com.atheris.platform.modules.regulators.entity.Regulator;
import com.microsoft.playwright.*;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@Slf4j
public class PlaywrightBrowserPool {

    private Playwright playwright;
    private Browser browser;

    @PostConstruct
    public void init() {
        log.info("Launching Playwright Chromium browser...");
        playwright = Playwright.create();
        browser = playwright.chromium().launch(new BrowserType.LaunchOptions()
            .setHeadless(true)
            .setArgs(List.of(
                Constants.PW_NO_SANDBOX,
                Constants.PW_DISABLE_DEV_SHM,
                Constants.PW_DISABLE_GPU,
                Constants.PW_DISABLE_EXTENSIONS,
                Constants.PW_DISABLE_BG_NETWORKING,
                Constants.PW_WINDOW_SIZE
            )));
        log.info("Playwright Chromium browser ready.");
    }

    @PreDestroy
    public void destroy() {
        log.info("Shutting down Playwright browser...");
        if (browser != null) browser.close();
        if (playwright != null) playwright.close();
    }

    public BrowserContext newContext(Regulator regulator) {
        Browser.NewContextOptions options = new Browser.NewContextOptions()
            .setUserAgent(Constants.USER_AGENT)
            .setIgnoreHTTPSErrors(true)
            .setViewportSize(1920, 1080);

        if (regulator.getRequestHeaders() != null) {
            Map<String, String> headers = new HashMap<>(regulator.getRequestHeaders());
            options.setExtraHTTPHeaders(headers);
        }
        return browser.newContext(options);
    }
}
