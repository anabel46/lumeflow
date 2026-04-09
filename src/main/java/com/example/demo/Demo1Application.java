package com.example.demo;

import com.fasterxml.jackson.databind.ObjectMapper; // Importação adicionada
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.web.reactive.function.client.WebClient;

@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})
public class Demo1Application {

    public static void main(String[] args) {
        SpringApplication.run(Demo1Application.class, args);
    }

    // Bean para o WebClient (que você já tinha)
    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }

    // ADICIONE ESTE BEAN ABAIXO:
    // Ele resolve o erro "required a bean of type ObjectMapper"
    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}