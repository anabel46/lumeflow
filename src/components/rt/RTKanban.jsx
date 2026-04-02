import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

const COLUMNS = [
{ id: "pendente", label: "Pendente", color: "bg-gray-600" },
{ id: "em_processo", label: "Em Processo", color: "bg-blue-600" },
{ id: "aguardando_nf", label: "Aguardando NF", color: "bg-yellow-600" },
{ id: "lancado_movimentacao", label: "Lançado na Movimentação", color: "bg-orange-600" },
{ id: "pagamento_realizado", label: "Pagamento Realizado", color: "bg-emerald-600" }];


export default function RTKanban({ pedidos, onEdit, onDelete, search }) {
  const filtered = pedidos.filter(
    (p) =>
    p.codigo_pedido?.toLowerCase().includes(search.toLowerCase()) ||
    p.nome_arquiteto?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map((column) => {
          const columnPedidos = filtered.filter((p) => p.status === column.id);
          return (
            <div key={column.id} className="flex-1 min-w-80 h-fit">
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-700">
                <div className={cn("w-3 h-3 rounded-full", column.color)} />
                <h3 className="text-[#0a0a0a] font-semibold">{column.label}</h3>
                <Badge variant="secondary" className="ml-auto bg-gray-800 text-gray-300">
                  {columnPedidos.length}
                </Badge>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {columnPedidos.length === 0 ?
                <div className="text-center py-8 text-gray-500 text-sm">
                    Nenhum pedido
                  </div> :

                columnPedidos.map((pedido) =>
                <div
                  key={pedido.id}
                  className="rounded-xl bg-gray-900 border border-gray-700 p-3 hover:border-gray-600 transition-all group">
                  
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-bold text-blue-400 truncate">
                            {pedido.codigo_pedido}
                          </p>
                          <p className="text-sm font-semibold text-white truncate">
                            {pedido.nome_arquiteto}
                          </p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                          <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-gray-400 hover:text-white"
                        onClick={() => onEdit(pedido)}>
                        
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-gray-400 hover:text-red-400"
                        onClick={() => onDelete(pedido.id)}>
                        
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1 text-xs text-gray-400">
                        <p>
                          <span className="text-gray-500">Valor RT:</span>{" "}
                          <span className="font-semibold text-emerald-400">
                            R$ {pedido.valor_rt?.toFixed(2).replace(".", ",") || "0,00"}
                          </span>
                        </p>
                        <p>
                          <span className="text-gray-500">Loja:</span> {pedido.loja || "-"}
                        </p>
                        <p>
                          <span className="text-gray-500">Mês:</span> {pedido.mes_referencia}
                        </p>
                      </div>
                    </div>
                )
                }
              </div>
            </div>);

        })}
      </div>
    </div>);

}