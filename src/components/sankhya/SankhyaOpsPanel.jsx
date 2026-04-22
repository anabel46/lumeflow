import React, { useState } from "react";
import SankhyaOpDetails from "./SankhyaOpDetails";

/**
 * Painel completo de OPs Sankhya para um pedido.
 * ops: array/objeto de OPs retornado do Sankhya
 */
export default function SankhyaOpsPanel({ ops = [], loading = false, error = null }) {
  const [expandedOps, setExpandedOps] = useState({});

  const toggleOp = (numeroOp) => {
    setExpandedOps((prev) => ({
      ...prev,
      [numeroOp]: !prev[numeroOp],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-12 bg-muted/40 rounded-lg border animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 border border-destructive/20">
        Erro ao carregar dados do ERP: {error}
      </p>
    );
  }

  // Converter objeto para array se necessário
  const opsList = Array.isArray(ops)
    ? ops
    : Object.values(ops || {});

  if (!opsList || opsList.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        Nenhuma OP encontrada no Sankhya para este pedido.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {opsList.map((op) => (
        <SankhyaOpDetails
          key={op.numeroOp}
          op={op}
          expanded={expandedOps[op.numeroOp]}
          onToggle={() => toggleOp(op.numeroOp)}
        />
      ))}
    </div>
  );
}