import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Copy, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";

const EMPRESA_DADOS = {
  nome: "STUDIO GUSTAVO DI MENNO DE ILUM. EIRELI.",
  cnpj: "22.544.181/0002-30",
  ie: "87024555",
  endereco: "R. BARÃO DE JAGUARIPE, 70 – IPANEMA – RIO DE JANEIRO – RJ",
  cep: "CEP: 22421-000",
};

export default function EmailGenerator({ pedidoRT, arquiteto }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const gerarTemplate = () => {
    return `Bom dia.

Favor emitir nota fiscal para pagamento de RT referente ao(s) pedido(s):

PEDIDO ${pedidoRT.codigo_pedido} R$ ${pedidoRT.valor_total_pedido.toFixed(2).replace(".", ",")} - R$ ${pedidoRT.valor_componentes.toFixed(2).replace(".", ",")} = R$ ${pedidoRT.valor_base_rt.toFixed(2).replace(".", ",")}

Total de RT R$ ${pedidoRT.valor_rt.toFixed(2).replace(".", ",")} (10%).

Seguem dados para emissão da Nota Fiscal:

${EMPRESA_DADOS.nome}
CNPJ: ${EMPRESA_DADOS.cnpj} / I.E.: ${EMPRESA_DADOS.ie}
${EMPRESA_DADOS.endereco} – ${EMPRESA_DADOS.cep}

Informações Bancárias:
${arquiteto?.dados_bancarios || "[Dados bancários não informados]"}

PIX:
${arquiteto?.pix || "[PIX não informado]"}

Observações importantes:
- Não mencionar Reserva Técnica (RT) no corpo da nota.
- Só aceitaremos dados bancários no nome da empresa que emitirá a nota.
- Não aceitamos nota com código de serviço obra (7.02 e 07.05).
- Só aceitaremos nota emitida e enviada dentro do mesmo mês.`;
  };

  const template = gerarTemplate();

  const handleCopy = () => {
    navigator.clipboard.writeText(template);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = async () => {
    if (!arquiteto?.email) {
      alert("Email do arquiteto não configurado");
      return;
    }

    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: arquiteto.email,
        subject: `Solicitação de NF - Pedido ${pedidoRT.codigo_pedido}`,
        body: template,
      });
      alert("Email enviado com sucesso!");
      setOpen(false);
    } catch (error) {
      alert("Erro ao enviar email: " + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Mail className="w-4 h-4" />
        Gerar E-mail de Solicitação de NF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitação de Nota Fiscal - Pedido {pedidoRT.codigo_pedido}</DialogTitle>
          </DialogHeader>

          <Textarea
            value={template}
            readOnly
            rows={20}
            className="font-mono text-xs bg-muted"
          />

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleCopy}
              variant="outline"
              className="gap-2 flex-1"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Texto
                </>
              )}
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={sending || !arquiteto?.email}
              className="gap-2 flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4" />
              {sending ? "Enviando..." : `Enviar para ${arquiteto?.email}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}