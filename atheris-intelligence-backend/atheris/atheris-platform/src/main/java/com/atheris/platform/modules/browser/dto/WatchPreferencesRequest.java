package com.atheris.platform.modules.browser.dto;

import lombok.Data;

@Data
public class WatchPreferencesRequest {
    private Boolean notifyEmail;
    private Boolean notifyInApp;
    private Boolean notifyWebhook;
}
