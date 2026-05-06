import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
dotenv.config();

@Injectable()
export class SankhyaService {
  private readonly logger = new Logger(SankhyaService.name);
  private cachedToken: string = '';
  private expiresAt = 0;
  private readonly MARGIN_MS = 60_000;

  // ── Auth ──────────────────────────────────────────────────────────────────
  private async getValidToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.expiresAt - this.MARGIN_MS) {
      return this.cachedToken;
    }
    return this.refreshToken();
  }

  private async refreshToken(): Promise<string> {
    const oauthUrl = process.env.SANKHYA_OAUTH_URL;
    const clientId = process.env.SANKHYA_CLIENT_ID;
    const clientSecret = process.env.SANKHYA_CLIENT_SECRET;
    const xToken = process.env.SANKHYA_X_TOKEN;

    if (!oauthUrl || !clientId || !clientSecret || !xToken) {
      throw new Error('Variáveis de ambiente Sankhya ausentes');
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await fetch(oauthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': xToken,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`Auth Sankhya falhou: ${await res.text()}`);

    const data = await res.json();
    this.cachedToken = data.access_token ?? '';
    this.expiresAt = Date.now() + data.expires_in * 1000;
    this.logger.log('Token Sankhya renovado com sucesso');
    return this.cachedToken;
  }

  // ── Query SQL ─────────────────────────────────────────────────────────────
  async executeQuery(sql: string): Promise<any> {
    const token = await this.getValidToken();
    const baseUrl = process.env.SANKHYA_BASE_URL;
    const url = `${baseUrl}/gateway/v1/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        serviceName: 'DbExplorerSP.executeQuery',
        requestBody: { sql },
      }),
    });

    if (res.status === 401) {
      this.cachedToken = '';
      return this.executeQuery(sql);
    }

    const json = await res.json();
    if (String(json.status) !== '1') {
      throw new Error(`Erro Sankhya: ${json.statusMessage}`);
    }

    return json.responseBody;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private buildIdx(meta: any[]): Record<string, number> {
    const idx: Record<string, number> = {};
    meta.forEach((m, i) => { idx[m.name.toUpperCase()] = i; });
    return idx;
  }

  private getLong(row: any[], idx: Record<string, number>, col: string): number | null {
    const v = row[idx[col.toUpperCase()]];
    if (v === undefined || v === null || v === '') return null;
    const n = Number(String(v).replace(/[^\d.-]/g, ''));
    return isNaN(n) ? null : n;
  }

  private getString(row: any[], idx: Record<string, number>, col: string): string {
    const v = row[idx[col.toUpperCase()]];
    return v !== undefined && v !== null ? String(v).trim() : '';
  }

  // ── Dashboard (existente) ─────────────────────────────────────────────────
  async getDashboard(opId?: string): Promise<any> {
    const filtroOp = opId ? `WHERE P.IDIPROC = ${Number(opId)}` : '';

    const SQL = `
      SELECT
        COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
        P.IDIPROC,
        P.STATUSPROC AS SITUACAO_GERAL,
        A.IDIATV,
        A.IDEFX,
        FX.DESCRICAO AS DESCRICAO_ATIVIDADE,
        CASE
          WHEN A.DHACEITE IS NULL THEN 'Aguardando aceite'
          WHEN (
            SELECT COUNT(1) FROM TPREIATV E
            WHERE E.IDIATV = A.IDIATV
              AND E.TIPO IN ('P', 'T', 'S')
              AND E.DHFINAL IS NULL
          ) > 0 THEN 'Em andamento'
          ELSE 'Finalizada'
        END AS SITUACAO_ATIV,
        A.DHINCLUSAO,
        A.DHACEITE,
        A.DHINICIO,
        ITE.CODPROD,
        PRO.DESCRPROD,
        PRO.REFERENCIA
      FROM TPRIPROC P
      INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
      LEFT JOIN TPREFX FX ON FX.IDEFX = A.IDEFX
      LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
      LEFT JOIN (
        SELECT NUNOTA, MIN(CODPROD) AS CODPROD
        FROM TGFITE
        GROUP BY NUNOTA
      ) ITE ON ITE.NUNOTA = P.NUNOTA
      LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
      ${filtroOp}
      ORDER BY NUMPEDIDO DESC, P.IDIPROC, A.IDIATV`;

    this.logger.log('Buscando dashboard Sankhya...');
    const body = await this.executeQuery(SQL);
    const pedidos = this.converterParaMap(body);

    return {
      pedidos,
      estatisticas: this.calcularEstatisticas(pedidos),
    };
  }

  // ── Pedidos (NOVO) ────────────────────────────────────────────────────────
private formatarData(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  // Formato que vem do Sankhya: "19122025 00:00:00"
  const s = raw.trim();
  const dia = s.substring(0, 2);
  const mes = s.substring(2, 4);
  const ano = s.substring(4, 8);
  return `${dia}/${mes}/${ano}`;
}

 async getPedidos(): Promise<any> {
  const SQL = `
    SELECT
      COALESCE(CAB.NUMPEDIDO, P.NUNOTA) AS NUMPEDIDO,
      P.IDIPROC,
      P.STATUSPROC AS SITUACAO_GERAL,
      CAB.DTNEG     AS DATA_PEDIDO,
      CAB.DTPREVENT AS DATA_ENTREGA,
      ITE.CODPROD,
      PRO.DESCRPROD,
      PRO.REFERENCIA,
      COUNT(A.IDIATV) AS TOTAL_ATIVIDADES,
      SUM(CASE WHEN A.DHACEITE IS NOT NULL THEN 1 ELSE 0 END) AS ATIVIDADES_FINALIZADAS
    FROM TPRIPROC P
    INNER JOIN TPRIATV A ON A.IDIPROC = P.IDIPROC
    LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = P.NUNOTA
    LEFT JOIN (
      SELECT NUNOTA, MIN(CODPROD) AS CODPROD
      FROM TGFITE
      GROUP BY NUNOTA
    ) ITE ON ITE.NUNOTA = P.NUNOTA
    LEFT JOIN TGFPRO PRO ON PRO.CODPROD = ITE.CODPROD
    GROUP BY
      COALESCE(CAB.NUMPEDIDO, P.NUNOTA),
      P.IDIPROC,
      P.STATUSPROC,
      CAB.DTNEG,
      CAB.DTPREVENT,
      ITE.CODPROD,
      PRO.DESCRPROD,
      PRO.REFERENCIA
    ORDER BY NUMPEDIDO DESC
  `;

  this.logger.log('Buscando pedidos Sankhya...');
  const body = await this.executeQuery(SQL);
  return this.converterPedidosParaLista(body);
}

  private converterPedidosParaLista(body: any): any[] {
    if (!body?.rows) return [];

    const idx = this.buildIdx(body.fieldsMetadata);
    const pedidosMap: Record<string, any> = {};

    for (const row of body.rows) {
      const pedido = this.getLong(row, idx, 'NUMPEDIDO');
      const op = this.getLong(row, idx, 'IDIPROC');
      if (!pedido) continue;

      const cPed = String(pedido);

      if (!pedidosMap[cPed]) {
        const situacaoGeral = this.getString(row, idx, 'SITUACAO_GERAL');

        pedidosMap[cPed] = {
          numeroPedido: pedido,
          origem: 'FÁBRICA',
dataPedido: this.formatarData(this.getString(row, idx, 'DATA_PEDIDO')),
dataEntrega: this.formatarData(this.getString(row, idx, 'DATA_ENTREGA')),
          status: this.mapearStatus(situacaoGeral),
          ordens: [],
          totalOps: 0,
          opsEmProducao: 0,
          opsFinalizadas: 0,
        };
      }

      if (op) {
        const totalAtiv = this.getLong(row, idx, 'TOTAL_ATIVIDADES') ?? 0;
        const finalizadas = this.getLong(row, idx, 'ATIVIDADES_FINALIZADAS') ?? 0;
        const situacaoOp = this.getString(row, idx, 'SITUACAO_GERAL');

        pedidosMap[cPed].ordens.push({
          numeroOp: op,
          produto: this.getString(row, idx, 'DESCRPROD'),
          referencia: this.getString(row, idx, 'REFERENCIA'),
          codigoProduto: this.getLong(row, idx, 'CODPROD'),
          status: this.mapearStatus(situacaoOp),
          progresso: totalAtiv > 0 ? Math.round((finalizadas / totalAtiv) * 100) : 0,
          totalAtividades: totalAtiv,
          atividadesFinalizadas: finalizadas,
        });

        pedidosMap[cPed].totalOps++;
        if (situacaoOp === 'A') pedidosMap[cPed].opsEmProducao++;
        if (situacaoOp === 'F') pedidosMap[cPed].opsFinalizadas++;
      }
    }

    return Object.values(pedidosMap);
  }

  private mapearStatus(codigo: string): string {
    const map: Record<string, string> = {
      P: 'pendente',
      A: 'em_producao',
      F: 'finalizado',
    };
    return map[codigo] ?? 'pendente';
  }

  // ── Converter rows para map (existente) ───────────────────────────────────
private converterParaMap(body: any): Record<string, Record<string, any>> {
  if (!body?.rows) return {};

  const idx = this.buildIdx(body.fieldsMetadata);
  const resultado: Record<string, Record<string, any>> = {};

  for (const row of body.rows) {
    const pedido = this.getLong(row, idx, 'NUMPEDIDO');
    const op = this.getLong(row, idx, 'IDIPROC');
    if (!pedido || !op) continue;

    const cPed = String(pedido);
    const cOp = String(op);

    if (!resultado[cPed]) resultado[cPed] = {};
    if (!resultado[cPed][cOp]) {
      resultado[cPed][cOp] = {
        numeroPedido: pedido,
        numeroOp: op,
        situacaoGeral: this.getString(row, idx, 'SITUACAO_GERAL'),
        atividades: [],
        produtos: [],
      };
    }

    const currentOp = resultado[cPed][cOp];

    const idAtiv = this.getString(row, idx, 'IDIATV');
    if (idAtiv && !currentOp.atividades.some((a: any) => a.id === idAtiv)) {
      currentOp.atividades.push({
        id: idAtiv,
        idefx: this.getString(row, idx, 'IDEFX'),
        descricao: this.getString(row, idx, 'DESCRICAO_ATIVIDADE'),
        situacao: this.getString(row, idx, 'SITUACAO_ATIV'),
        dhInclusao: this.formatarData(this.getString(row, idx, 'DHINCLUSAO')),
        dhAceite: this.formatarData(this.getString(row, idx, 'DHACEITE')),
        dhInicio: this.formatarData(this.getString(row, idx, 'DHINICIO')),
      });
    }

    const codProd = this.getLong(row, idx, 'CODPROD');
    if (codProd && !currentOp.produtos.some((p: any) => p.codigo === codProd)) {
      currentOp.produtos.push({
        codigo: codProd,
        descricao: this.getString(row, idx, 'DESCRPROD'),
        referencia: this.getString(row, idx, 'REFERENCIA'),
      });
    }
  }

  return resultado;
}

  // ── Estatísticas (existente) ──────────────────────────────────────────────
  private calcularEstatisticas(pedidosMap: Record<string, Record<string, any>>) {
    const stats = { totalOps: 0, aguardando: 0, emAndamento: 0, finalizadas: 0 };
    Object.values(pedidosMap).forEach(ops => {
      Object.values(ops).forEach((op: any) => {
        stats.totalOps++;
        if (op.situacaoGeral === 'P') stats.aguardando++;
        else if (op.situacaoGeral === 'A') stats.emAndamento++;
        else if (op.situacaoGeral === 'F') stats.finalizadas++;
      });
    });
    return stats;
  }
}