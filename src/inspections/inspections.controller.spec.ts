import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { InspectionsController } from './inspections.controller';
import { InspectionsService } from './inspections.service';

describe('InspectionsController', () => {
  let controller: InspectionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InspectionsController],
      providers: [
        InspectionsService,
        { provide: PrismaService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InspectionsController>(InspectionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});