package com.example.demo;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class OpDTO {

    @JsonProperty("NUMPEDIDO")
    private Long numeroPedido;

    @JsonProperty("IDIPROC")
    private Long numeroOp;

    @JsonProperty("STATUSPROC")
    private String situacao;

    @JsonProperty("CODPROD")
    private Long codigoProduto;

    @JsonProperty("DESCRPROD")
    private String descricaoProduto;

    @JsonProperty("REFERENCIA")
    private String referencia;

    @JsonProperty("DHINCLUSAO")
    private String dhEntrada;

    @JsonProperty("DHACEITE")
    private String dhAceite;

    @JsonProperty("DHINICIO")
    private String dhInicio;

    // Campo consolidado
    private List<Map<String, Object>> produtos;
}