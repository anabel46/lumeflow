package com.example.demo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data // O Lombok usa isso para criar os Getters e Setters automaticamente
public class SankhyaTokenResponse {
    @JsonProperty("access_token") // Mapeia o campo do JSON do Sankhya para a variável Java
    private String accessToken;

    @JsonProperty("token_type")
    private String tokenType;

    @JsonProperty("expires_in")
    private Long expiresIn;
}