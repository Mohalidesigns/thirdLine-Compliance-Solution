package com.atheris.compliance.intelligence.backend.shared.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.MappingJackson2HttpMessageConverter;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Primary + fallback chat models for {@link AiClient}.
 *
 * The primary is Spring AI's auto-configured OpenAI-compatible model (spring.ai.openai.* — pointed
 * at Google Gemini's OpenAI-compatible endpoint). The fallback can be a SECOND provider with its
 * own base-url + key (e.g. the ISW AI gateway). Model ids are env-driven; credentials live in env
 * vars only.
 *
 * Both clients use a JSON-tolerant message converter: some providers (Gemini, the gateway) return
 * large completions with a missing/`application/octet-stream` Content-Type, which Spring's default
 * converter set refuses to parse as JSON. We register a Jackson converter that also accepts
 * octet-stream so those responses still deserialize.
 *
 * {@code atheris.ai.reasoning-enabled} ({@code AI_REASONING_ENABLED}): unset sends nothing;
 * {@code true}/{@code false} adds OpenRouter's {@code "reasoning": {"enabled": ...}} — see
 * {@link ReasoningToggleInterceptor}.
 */
@Configuration @Slf4j
public class AiConfig {

    @Value("${atheris.ai.primary-model}")
    private String primaryModelName;

    @Value("${atheris.ai.fallback-model}")
    private String fallbackModelName;

    @Value("${atheris.ai.reasoning-enabled:}")
    private String reasoningEnabled;

    /** Fallback provider: its own base-url + key (e.g. the ISW gateway). Blank = same as primary. */
    @Value("${atheris.ai.fallback-base-url:}")
    private String fallbackBaseUrl;

    @Value("${atheris.ai.fallback-api-key:}")
    private String fallbackApiKey;

    private final ObjectMapper objectMapper;

    public AiConfig(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Bean("primaryChatModel")
    @Primary
    public ChatModel primaryChatModel(OpenAiChatModel openAiChatModel, OpenAiApi openAiApi,
                                      ObjectProvider<RestClient.Builder> restClientBuilder) {
        return withModel(openAiChatModel, apiFor(openAiApi, restClientBuilder), primaryModelName);
    }

    @Bean("fallbackChatModel")
    public ChatModel fallbackChatModel(OpenAiChatModel openAiChatModel,
                                       ObjectProvider<RestClient.Builder> restClientBuilder) {
        // No separate provider configured -> the fallback shares the primary's provider.
        if (fallbackBaseUrl == null || fallbackBaseUrl.isBlank()) {
            return withModel(openAiChatModel, null, fallbackModelName);
        }
        OpenAiApi.Builder apiBuilder = OpenAiApi.builder()
            .baseUrl(fallbackBaseUrl)
            .restClientBuilder(tolerantRestClient(restClientBuilder));
        if (fallbackApiKey != null && !fallbackApiKey.isBlank()) {
            apiBuilder.apiKey(fallbackApiKey);
        }
        log.info("[AiConfig] Fallback model {} via {} (separate provider)", fallbackModelName, fallbackBaseUrl);
        return withModel(openAiChatModel, apiBuilder.build(), fallbackModelName);
    }

    /** The auto-configured API with a JSON-tolerant RestClient (plus the reasoning switch when set). */
    private OpenAiApi apiFor(OpenAiApi base, ObjectProvider<RestClient.Builder> restClientBuilder) {
        RestClient.Builder builder = tolerantRestClient(restClientBuilder);
        Boolean flag = parseFlag(reasoningEnabled);
        if (flag != null) {
            log.info("[AiConfig] Sending \"reasoning\": {\"enabled\": {}} on every chat request", flag);
            builder.requestInterceptor(new ReasoningToggleInterceptor(flag, "/chat/completions"));
        }
        return base.mutate().restClientBuilder(builder).build();
    }

    /**
     * A RestClient.Builder whose converter list starts with a Jackson converter that also accepts
     * {@code application/octet-stream} (and any content type), so a completion whose Content-Type
     * header is missing or wrong still deserializes as JSON instead of blowing up.
     */
    private RestClient.Builder tolerantRestClient(ObjectProvider<RestClient.Builder> restClientBuilder) {
        RestClient.Builder builder = restClientBuilder.getIfAvailable(RestClient::builder);
        MappingJackson2HttpMessageConverter json = new MappingJackson2HttpMessageConverter(objectMapper);
        List<MediaType> types = new ArrayList<>(json.getSupportedMediaTypes());
        types.add(MediaType.APPLICATION_OCTET_STREAM);
        types.add(MediaType.ALL);
        json.setSupportedMediaTypes(types);
        log.info("[AiConfig] registering JSON-tolerant converter (supports {})", types);
        builder.messageConverters(converters -> {
            List<HttpMessageConverter<?>> list = new ArrayList<>(converters);
            list.add(0, json);
            converters.clear();
            converters.addAll(list);
        });
        // Belt-and-braces: some providers omit the Content-Type on long completions, which Spring
        // defaults to application/octet-stream. Rewrite it to application/json on the way out.
        builder.requestInterceptor(new JsonContentTypeInterceptor());
        return builder;
    }

    /**
     * Rewrites a missing / {@code application/octet-stream} response Content-Type to
     * {@code application/json} so Spring's Jackson converter will deserialize the body.
     */
    private static final class JsonContentTypeInterceptor implements ClientHttpRequestInterceptor {
        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body,
                                            ClientHttpRequestExecution execution) throws IOException {
            ClientHttpResponse response = execution.execute(request, body);
            MediaType ct = response.getHeaders().getContentType();
            if (ct == null || ct.isCompatibleWith(MediaType.APPLICATION_OCTET_STREAM)) {
                return new JsonContentTypeResponse(response);
            }
            return response;
        }
    }

    private static final class JsonContentTypeResponse implements ClientHttpResponse {
        private final ClientHttpResponse delegate;
        private final HttpHeaders headers;

        JsonContentTypeResponse(ClientHttpResponse delegate) {
            this.delegate = delegate;
            this.headers = new HttpHeaders();
            this.headers.putAll(delegate.getHeaders());
            this.headers.setContentType(MediaType.APPLICATION_JSON);
        }

        @Override public HttpHeaders getHeaders() { return headers; }
        @Override public InputStream getBody() throws IOException { return delegate.getBody(); }
        @Override public HttpStatusCode getStatusCode() throws IOException { return delegate.getStatusCode(); }
        @Override public String getStatusText() throws IOException { return delegate.getStatusText(); }
        @Override public void close() { delegate.close(); }
    }

    static Boolean parseFlag(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String v = raw.trim();
        if ("true".equalsIgnoreCase(v)) return Boolean.TRUE;
        if ("false".equalsIgnoreCase(v)) return Boolean.FALSE;
        throw new IllegalStateException("atheris.ai.reasoning-enabled must be true, false or unset, got: " + raw);
    }

    private static ChatModel withModel(OpenAiChatModel base, OpenAiApi api, String modelName) {
        OpenAiChatOptions options = ((OpenAiChatOptions) base.getDefaultOptions()).copy();
        options.setModel(modelName);
        OpenAiChatModel.Builder builder = base.mutate().defaultOptions(options);
        if (api != null) builder.openAiApi(api);
        return builder.build();
    }
}
