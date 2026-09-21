import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dtos/create-inspection.dto';
import { InspectionsService } from './inspections.service';


describe('InspectionsService', () => {
  let service: InspectionsService;
  let prisma: any;

  const baseDto: CreateInspectionDto = {
    dealId: 'deal-1',
    inspectorName: 'Samuel Pérez',
    systemType: 'TRIFASICO' as any,
    originPoint: 'Tablero principal',
    hasPanelSpace: true,
    requiresDrilling: false,
    differentialProtectionRequired: true,
  } as CreateInspectionDto;

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      inspection: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InspectionsService>(InspectionsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea la inspección si el deal existe y no tiene una previa', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1' });
      prisma.inspection.findUnique.mockResolvedValue(null);
      prisma.inspection.create.mockResolvedValue({ id: 'insp-1', ...baseDto });

      await service.create(baseDto);

      expect(prisma.inspection.create).toHaveBeenCalledWith({ data: baseDto });
    });

    it('lanza NotFoundException si el deal no existe, y nunca crea', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(
        new NotFoundException(`El deal ${baseDto.dealId} no existe`),
      );

      expect(prisma.inspection.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el deal ya tiene una inspección, y nunca crea', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1' });
      prisma.inspection.findUnique.mockResolvedValue({ id: 'insp-existente' });

      await expect(service.create(baseDto)).rejects.toThrow(
        new ConflictException(`El deal ${baseDto.dealId} ya tiene una inspección registrada`),
      );

      expect(prisma.inspection.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('incluye el deal en la respuesta', async () => {
      await service.findAll();

      expect(prisma.inspection.findMany).toHaveBeenCalledWith({ include: { deal: true } });
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si no existe', async () => {
      prisma.inspection.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        new NotFoundException('Inspección no-existe no encontrada'),
      );
    });
  });

  describe('update', () => {
    it('ignora un dealId inyectado en el body', async () => {
      const id = 'insp-1';
      prisma.inspection.findUnique.mockResolvedValue({ id, status: 'PENDIENTE' });
      prisma.inspection.update.mockResolvedValue({ id });

      await service.update(id, { dealId: 'otro-deal', observations: 'todo bien' } as any);

      expect(prisma.inspection.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          observations: 'todo bien',
          approvedAt: undefined,
        },
      });
    });

    it('sella approvedAt automáticamente al pasar a APROBADA', async () => {
      const id = 'insp-1';
      prisma.inspection.findUnique.mockResolvedValue({ id, status: 'PENDIENTE' });
      prisma.inspection.update.mockResolvedValue({ id, status: 'APROBADA' });

      await service.update(id, { status: 'APROBADA' } as any);

      const callArgs = prisma.inspection.update.mock.calls[0][0];
      expect(callArgs.data.status).toBe('APROBADA');
      expect(callArgs.data.approvedAt).toBeInstanceOf(Date);
    });

    it('NO sella approvedAt si el status no es APROBADA', async () => {
      const id = 'insp-1';
      prisma.inspection.findUnique.mockResolvedValue({ id, status: 'PENDIENTE' });
      prisma.inspection.update.mockResolvedValue({ id, status: 'RECHAZADA' });

      await service.update(id, { status: 'RECHAZADA' } as any);

      expect(prisma.inspection.update).toHaveBeenCalledWith({
        where: { id },
        data: { status: 'RECHAZADA', approvedAt: undefined },
      });
    });
  });
});