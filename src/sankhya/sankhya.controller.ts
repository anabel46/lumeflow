import { Controller, Get } from '@nestjs/common';
import { SankhyaService } from './sankhya.service';

@Controller('sankhya')
export class SankhyaController {
  constructor(private readonly sankhyaService: SankhyaService) {}

  // Tela de Produção (existente)
  @Get('dashboard')
  async getDashboard() {
    return this.sankhyaService.getDashboard();
  }

  // Tela de Pedidos (NOVO)
  @Get('pedidos')
  async getPedidos() {
    return this.sankhyaService.getPedidos();
  }
}