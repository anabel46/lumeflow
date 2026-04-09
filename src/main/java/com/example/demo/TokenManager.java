package com.example.demo;

import com.example.demo.AuthService;
import com.example.demo.SankhyaTokenResponse;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
public class TokenManager {
    private final AuthService authService;
    private String cachedToken;
    private Instant expiryTime;
    private static final long MARGIN_SECONDS = 60; // Margem de segurança de 60s

    public TokenManager(AuthService authService) {
        this.authService = authService;
    }

    public synchronized String getValidToken() {
        // Se o token não existe ou está prestes a expirar, renova
        if (cachedToken == null || Instant.now().isAfter(expiryTime.minusSeconds(MARGIN_SECONDS))) {
            refreshToken();
        }
        return cachedToken;
    }

    public synchronized void forceRefresh() {
        refreshToken(); // Útil para erros 401 inesperados
    }

    private void refreshToken() {
        // Chamada síncrona para garantir que o resto do sistema espere o novo token
        com.example.demo.SankhyaTokenResponse response = authService.getAccessTokenResponse().block();

        if (response != null) {
            this.cachedToken = response.getAccessToken();
            // Calcula o tempo exato de expiração baseado no campo expires_in
            this.expiryTime = Instant.now().plusSeconds(response.getExpiresIn());
        }
    }
}