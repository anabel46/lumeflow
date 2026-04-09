package com.example.demo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.*;

@Service
public class SankhyaService {

    private final WebClient webClient;
    private final TokenManager tokenManager;
    private final ObjectMapper objectMapper;

    public SankhyaService(WebClient.Builder webClientBuilder,
                          TokenManager tokenManager,
                          ObjectMapper objectMapper) {
        this.webClient = webClientBuilder
                .baseUrl("https://api.sandbox.sankhya.com.br")
                .build();
        this.tokenManager = tokenManager;
        this.objectMapper = objectMapper;
    }

    public Mono<Map<String, Object>> buscarProcessosPorPedido() {
        String token = tokenManager.getValidToken();

        String sql = """
            SELECT TOP 50
                COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
                P.IDIPROC,
                P.STATUSPROC,
                MAX(A.DHINCLUSAO) AS DHINCLUSAO,
                MAX(A.DHACEITE) AS DHACEITE,
                MAX(A.DHINICIO) AS DHINICIO,
                ITE.CODPROD,
                PRO.DESCRPROD,
                PRO.REFERENCIA
            FROM TPRIPROC P
            INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
            LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
            LEFT JOIN TGFITE ITE ON ITE.NUNOTA = P.NUNOTA
            LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
            WHERE P.NUNOTA IS NOT NULL
            AND P.STATUSPROC = 'A'
            GROUP BY 
                COALESCE(CAB.NUMPEDIDO, P.NUNOTA),
                P.IDIPROC,
                P.STATUSPROC,
                ITE.CODPROD,
                PRO.DESCRPROD,
                PRO.REFERENCIA
            ORDER BY NUMPEDIDO DESC, IDIPROC
            """;

        return executarQuery(token, sql)
                .map(this::converterParaMap);
    }

    private Mono<String> executarQuery(String token, String sql) {
        String sqlLimpo = sql.replace("\"", "\\\"").replace("\n", " ");
        String payload = "{\"serviceName\":\"DbExplorerSP.executeQuery\","
                + "\"requestBody\":{\"sql\":\"" + sqlLimpo + "\"}}";

        return this.webClient.post()
                .uri("/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json")
                .header("Authorization", "Bearer " + token)
                .header("Content-Type", "application/json")
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .onErrorReturn("{\"status\":\"0\",\"statusMessage\":\"ERRO_HTTP\"}");
    }

    private Map<String, Object> converterParaMap(String json) {
        try {
            JsonNode root = objectMapper.readTree(json);

            if (!"1".equals(root.path("status").asText())) {
                return Map.of("erro", root.path("statusMessage").asText());
            }

            JsonNode meta = root.path("responseBody").path("fieldsMetadata");
            Map<String, Integer> colIndex = new HashMap<>();
            for (int i = 0; i < meta.size(); i++) {
                colIndex.put(meta.get(i).path("name").asText().toUpperCase(), i);
            }

            JsonNode rows = root.path("responseBody").path("rows");

            // Agrupar por Pedido -> OP
            Map<String, Map<String, Object>> resultado = new LinkedHashMap<>();

            for (JsonNode row : rows) {
                Long pedido = getLong(row, colIndex, "NUMPEDIDO");
                Long op = getLong(row, colIndex, "IDIPROC");

                if (pedido == null || op == null) continue;

                String chavePedido = String.valueOf(pedido);
                String chaveOp = String.valueOf(op);

                // Criar ou recuperar OP
                Map<String, Object> opMap = (Map<String, Object>) resultado
                        .computeIfAbsent(chavePedido, k -> new LinkedHashMap<>())
                        .computeIfAbsent(chaveOp, k -> {
                            Map<String, Object> m = new LinkedHashMap<>();
                            m.put("numeroPedido", pedido);
                            m.put("numeroOp", op);
                            m.put("situacao", getString(row, colIndex, "STATUSPROC"));
                            m.put("dhEntrada", formatarData(getNode(row, colIndex, "DHINCLUSAO")));
                            m.put("dhAceite", formatarData(getNode(row, colIndex, "DHACEITE")));
                            m.put("dhInicio", formatarData(getNode(row, colIndex, "DHINICIO")));
                            m.put("produtos", new ArrayList<Map<String, Object>>());
                            return m;
                        });

                // Adicionar produto se não existir
                List<Map<String, Object>> produtos = (List<Map<String, Object>>) opMap.get("produtos");
                Long codProd = getLong(row, colIndex, "CODPROD");

                boolean existe = produtos.stream().anyMatch(p -> p.get("codigo").equals(codProd));
                if (!existe && codProd != null) {
                    Map<String, Object> prod = new LinkedHashMap<>();
                    prod.put("codigo", codProd);
                    prod.put("descricao", getString(row, colIndex, "DESCRPROD"));
                    prod.put("referencia", getString(row, colIndex, "REFERENCIA"));
                    produtos.add(prod);
                }
            }

            return new LinkedHashMap<>(resultado);

        } catch (Exception e) {
            return Map.of("erro", e.getMessage());
        }
    }

    private JsonNode getNode(JsonNode row, Map<String, Integer> idx, String col) {
        Integer i = idx.get(col.toUpperCase());
        return (i == null || i >= row.size()) ? null : row.get(i);
    }

    private Long getLong(JsonNode row, Map<String, Integer> idx, String col) {
        JsonNode n = getNode(row, idx, col);
        if (n == null || n.isNull()) return null;
        try {
            String txt = n.asText().trim();
            if (txt.isEmpty() || "null".equalsIgnoreCase(txt)) return null;
            return Long.parseLong(txt.replaceAll("\\D", ""));
        } catch (Exception e) { return null; }
    }

    private String getString(JsonNode row, Map<String, Integer> idx, String col) {
        JsonNode n = getNode(row, idx, col);
        return (n == null || n.isNull()) ? "" : n.asText().trim();
    }

    private String formatarData(JsonNode node) {
        if (node == null || node.isNull()) return "";
        String r = node.asText().trim();
        if (r.length() >= 8)
            return r.substring(0, 2) + "/" + r.substring(2, 4) + "/"
                    + r.substring(4, 8) + (r.length() > 8 ? " " + r.substring(9) : "");
        return r;
    }
}