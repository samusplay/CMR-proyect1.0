import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      campaign: { findUnique: jest.fn() },
      lead: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea el lead sin problema si no manda campaignId (es opcional)', async () => {
      const dto = { name: 'Samuel', email: 'samuel@test.com' } as CreateLeadDto;
      prisma.lead.create.mockResolvedValue({ id: '1', ...dto });

      await service.create(dto);

      expect(prisma.campaign.findUnique).not.toHaveBeenCalled();
      expect(prisma.lead.create).toHaveBeenCalledWith({ data: dto });
    });

    it('valida que la campaña exista si manda campaignId', async () => {
      const dto = { name: 'Samuel', email: 'samuel@test.com', campaignId: 'camp-1' } as CreateLeadDto;
      prisma.campaign.findUnique.mockResolvedValue({ id: 'camp-1' });
      prisma.lead.create.mockResolvedValue({ id: '1', ...dto });

      await service.create(dto);

      expect(prisma.campaign.findUnique).toHaveBeenCalledWith({ where: { id: 'camp-1' } });
      expect(prisma.lead.create).toHaveBeenCalledWith({ data: dto });
    });

    it('lanza NotFoundException si la campaña indicada no existe', async () => {
      const dto = { name: 'Samuel', email: 'samuel@test.com', campaignId: 'no-existe' } as CreateLeadDto;
      prisma.campaign.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException('La campaña no-existe no existe'),
      );

      expect(prisma.lead.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('incluye campaign y deal en la respuesta', async () => {
      await service.findAll();

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        include: { campaign: true, deal: true },
      });
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si el lead no existe', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        new NotFoundException('Lead no-existe no encontrado'),
      );
    });

    it('retorna el lead con su campaign y deal si existe', async () => {
      const mockLead = { id: '1', campaign: null, deal: null };
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.findOne('1');

      expect(result).toEqual(mockLead);
    });
  });

  describe('remove', () => {
    it('borra el lead de verdad (delete real, no soft delete)', async () => {
      prisma.lead.findUnique.mockResolvedValue({ id: '1' });

      await service.remove('1');

      expect(prisma.lead.delete).toHaveBeenCalledWith({ where: { id: '1' } });
    });

    it('lanza NotFoundException si intenta borrar un lead que no existe', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.remove('no-existe')).rejects.toThrow(NotFoundException);

      expect(prisma.lead.delete).not.toHaveBeenCalled();
    });
  });
});