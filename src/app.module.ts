import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SankhyaModule } from './sankhya/sankhya.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SankhyaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}