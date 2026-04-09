package com.example.demo;

import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;
import java.util.Map;

@RestController
@RequestMapping("/api") // Prefixo base para todos os seus endpoints de API
@CrossOrigin(origins = "https://lume-flow.base44.app/producao") // Permite acesso para testes locais
public class ProducaoController {

    private final SankhyaService sankhyaService;

    public ProducaoController(SankhyaService sankhyaService) {
        this.sankhyaService = sankhyaService;
    }

    // Agora a URL será: http://localhost:8080/api/producao
    @GetMapping("/producao")
    public Mono<Map<String, Object>> getDashboard() {
        System.out.println("📊 API de Produção acessada com sucesso!");
        return sankhyaService.buscarProcessosPorPedido();
    }
}