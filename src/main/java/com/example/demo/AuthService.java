package com.example.demo;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;
import reactor.core.publisher.Mono;

@Service
public class AuthService {

    private final WebClient webClient;

    @Value("${sankhya.oauth.url}")
    private String oauthUrl;

    @Value("${sankhya.client-id}")
    private String clientId;

    @Value("${sankhya.client-secret}")
    private String clientSecret;

    @Value("${sankhya.x-token}")
    private String xToken;

    public AuthService(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    // Altere de Mono<String> para Mono<SankhyaTokenResponse>
    public Mono<SankhyaTokenResponse> getAccessTokenResponse() {
        return this.webClient.post()
                .uri(oauthUrl)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("X-Token", xToken)
                .body(BodyInserters.fromFormData("grant_type", "client_credentials")
                        .with("client_id", clientId)
                        .with("client_secret", clientSecret))
                .retrieve()
                .bodyToMono(SankhyaTokenResponse.class); // Retorna o objeto completo
    }
}