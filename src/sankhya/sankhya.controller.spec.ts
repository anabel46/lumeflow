import { Test, TestingModule } from '@nestjs/testing';
import { SankhyaController } from './sankhya.controller';

describe('SankhyaController', () => {
  let controller: SankhyaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SankhyaController],
    }).compile();

    controller = module.get<SankhyaController>(SankhyaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
