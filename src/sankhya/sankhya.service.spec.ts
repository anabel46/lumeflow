import { Test, TestingModule } from '@nestjs/testing';
import { SankhyaService } from './sankhya.service';
import {beforeEach, describe, it, expect } from '@jest/globals';

describe('SankhyaService', () => {
  let service: SankhyaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SankhyaService],
    }).compile();

    service = module.get<SankhyaService>(SankhyaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
