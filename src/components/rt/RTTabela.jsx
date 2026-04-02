import React from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function RTTabela({ pedidos, onEdit, search }) {
  const filtered = pedidos.filter(
    (p) =>
      p.codigo_pedido?.toLowerCase().includes(search.toLowerCase()) ||
      p.nome_arquiteto?.toLowerCase().includes(search.toLowerCase())
  );

  const exportarExcel = () => {
    const data = filtered.map((p) => ({
      "Código do Pedido": p.codigo_pedido,
      "Valor Total": p.valor_total_pedido?.toFixed(2) || "",
      "Valor Componentes": p.valor_componentes?.toFixed(2) || "",
      "Valor Base RT": p.valor_base_rt?.toFixed(2) || "",
      "10% RT": p.valor_rt?.toFixed(2) || "",
      "Nome do Arquiteto": p.nome_arquiteto,
      "Emite NF": p.status === "aguardando_nf" ? "Sim" : "Não",
      "Dados Bancários": "", // Preenchido na NF
      "Anexo da NF": "",
      Observações: p.observacoes || "",
      "Data do Pagamento": p.data_pagamento || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RTs");

    // Styling
    ws["!cols"] = Array(11).fill({ wch: 20 });

    XLSX.writeFile(wb, `relatorio_rt_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={exportarExcel}
          variant="outline"
          className="gap-2 border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <Download className="w-4 h-4" />
          Exportar para Excel
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-900/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 bg-gray-800/50">
              <th className="px-4 py-3 text-left font-semibold text-gray-300">
                Código
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">
                Arquiteto
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">
                Valor Total
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">
                Componentes
              </th>
              <th className="px-4 py-3 text-right font-semibold text-gray-300">
                Base RT
              </th>
              <th className="px-4 py-3 text-right font-semibold text-emerald-400">
                10% RT
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">
                Mês
              </th>
              <th className="px-4 py-3 text-left font-semibold text-gray-300">
                Status
              </th>
              <th className="px-4 py-3 text-center font-semibold text-gray-300">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pedido, idx) => (
              <tr
                key={pedido.id}
                className={cn(
                  "border-b border-gray-700/50 transition-colors",
                  idx % 2 === 0 ? "bg-gray-900/30" : "bg-gray-800/20",
                  "hover:bg-gray-800/50"
                )}
              >
                <td className="px-4 py-3 font-mono text-blue-400 font-semibold">
                  {pedido.codigo_pedido}
                </td>
                <td className="px-4 py-3 text-white">{pedido.nome_arquiteto}</td>
                <td className="px-4 py-3 text-right text-gray-300">
                  R$ {pedido.valor_total_pedido?.toFixed(2).replace(".", ",") || "0,00"}
                </td>
                <td className="px-4 py-3 text-right text-gray-400">
                  R$ {pedido.valor_componentes?.toFixed(2).replace(".", ",") || "0,00"}
                </td>
                <td className="px-4 py-3 text-right text-gray-300">
                  R$ {pedido.valor_base_rt?.toFixed(2).replace(".", ",") || "0,00"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-emerald-400">
                  R$ {pedido.valor_rt?.toFixed(2).replace(".", ",") || "0,00"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{pedido.mes_referencia}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded-full font-medium",
                      pedido.status === "pendente" && "bg-gray-600/50 text-gray-300",
                      pedido.status === "em_processo" && "bg-blue-600/50 text-blue-300",
                      pedido.status === "aguardando_nf" && "bg-yellow-600/50 text-yellow-300",
                      pedido.status === "lancado_movimentacao" && "bg-orange-600/50 text-orange-300",
                      pedido.status === "pagamento_realizado" && "bg-emerald-600/50 text-emerald-300"
                    )}
                  >
                    {pedido.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onEdit(pedido)}
                    className="text-gray-400 hover:text-white"
                  >
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";