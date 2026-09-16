import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dtos/create-inspection.dto';
import { InspectionsService } from './inspections.service';


describe('InspectionsService', () => {
  let service: InspectionsService;
  let prisma: any;

  const baseDto: CreateInspectionDto = {
    clientId: 'client-1',
    inspectorName: 'Samuel Pérez',
    systemType: 'TRIFASICO' as any,
    originPoint: 'Tablero principal',
    hasPanelSpace: true,
    requiresDrilling: false,
    differentialProtectionRequired: true,
  } as CreateInspectionDto;

  beforeEach(async () => {
    prisma = {
      client: { findUnique: jest.fn() },
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
    it('crea la inspección si el cliente existe y no tiene una previa', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: 'client-1' });
      prisma.inspection.findUnique.mockResolvedValue(null);
      prisma.inspection.create.mockResolvedValue({ id: 'insp-1', ...baseDto });

      await service.create(baseDto);

      expect(prisma.inspection.create).toHaveBeenCalledWith({ data: baseDto });
    });

    it('lanza NotFoundException si el cliente no existe, y nunca crea', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto)).rejects.toThrow(
        new NotFoundException(`El cliente ${baseDto.clientId} no existe`),
      );

      expect(prisma.inspection.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el cliente ya tiene una inspección, y nunca crea', async () => {
      prisma.client.findUnique.mockResolvedValue({ id: 'client-1' });
      prisma.inspection.findUnique.mockResolvedValue({ id: 'insp-existente' });

      await expect(service.create(baseDto)).rejects.toThrow(
        new ConflictException(`El cliente ${baseDto.clientId} ya tiene una inspección registrada`),
      );

      expect(prisma.inspection.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('incluye el client en la respuesta', async () => {
      await service.findAll();

      expect(prisma.inspection.findMany).toHaveBeenCalledWith({ include: { client: true } });
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
    it('ignora un clientId inyectado en el body', async () => {
      const id = 'insp-1';
      prisma.inspection.findUnique.mockResolvedValue({ id, status: 'PENDIENTE' });
      prisma.inspection.update.mockResolvedValue({ id });

      await service.update(id, { clientId: 'otro-cliente', observations: 'todo bien' } as any);

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