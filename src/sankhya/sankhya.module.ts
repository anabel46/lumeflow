import { Module } from '@nestjs/common';
import { SankhyaController } from './sankhya.controller';
import { SankhyaService } from './sankhya.service';

@Module({
  controllers: [SankhyaController],
  providers: [SankhyaService],
})
export class SankhyaModule {}