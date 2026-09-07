import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dtos/create-campaign.dto';
import { UpdateCampaignDto } from './dtos/update-campaign.dto';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      campaign: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('normaliza channel y utmSource a minúsculas sin espacios', async () => {
      const dto = { channel: '  FACEBOOK  ', utmSource: '  Ads  ' } as CreateCampaignDto;

      await service.create(dto);

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: { ...dto, channel: 'facebook', utmSource: 'ads' },
      });
    });

    it('crea la campaña aunque utmSource no venga (es opcional)', async () => {
      const dto = { channel: 'google' } as CreateCampaignDto;

      await service.create(dto);

      expect(prisma.campaign.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ utmSource: undefined }),
      });
    });

    it('lanza BadRequestException si el canal no está permitido, y nunca crea', () => {
      const dto = { channel: 'tiktok' } as CreateCampaignDto;

      expect(() => service.create(dto)).toThrow(
        new BadRequestException('Canal inválido: tiktok'),
      );
      expect(prisma.campaign.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('solo consulta campañas activas', async () => {
      await service.findAll();

      expect(prisma.campaign.findMany).toHaveBeenCalledWith({ where: { active: true } });
    });
  });

  describe('findOne', () => {
    it('busca la campaña por id', async () => {
      const id = 'uuid-1234';

      await service.findOne(id);

      expect(prisma.campaign.findUnique).toHaveBeenCalledWith({ where: { id } });
    });
  });

  describe('update', () => {
    it('actualiza los datos enviados', async () => {
      const id = 'uuid-1234';
      const dto = { channel: 'google' } as UpdateCampaignDto;

      await service.update(id, dto);

      expect(prisma.campaign.update).toHaveBeenCalledWith({ where: { id }, data: dto });
    });
  });

  describe('remove', () => {
    it('hace soft delete: active en false, no borra de verdad', async () => {
      const id = 'uuid-1234';

      await service.remove(id);

      expect(prisma.campaign.update).toHaveBeenCalledWith({
        where: { id },
        data: { active: false },
      });
    });
  });
});