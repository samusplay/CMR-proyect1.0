import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DealWonEvent } from '../leads/events/deal-won.event';
import { PrismaService } from '../prisma/prisma.service';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      client: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('handleDealWon', () => {
    it('crea el cliente copiando los datos del lead cuando el deal existe y no tiene cliente aún', async () => {
      const event = new DealWonEvent('deal-1');

      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal-1',
        lead: { name: 'Samuel Pérez', email: 'samuel@test.com', phone: '3001234567' },
      });
      prisma.client.findUnique.mockResolvedValue(null); // no existe cliente todavía

      await service.handleDealWon(event);

      expect(prisma.client.create).toHaveBeenCalledWith({
        data: {
          name: 'Samuel Pérez',
          email: 'samuel@test.com',
          phone: '3001234567',
          dealId: 'deal-1',
        },
      });
    });

    it('no hace nada si el deal del evento no existe', async () => {
      const event = new DealWonEvent('deal-fantasma');
      prisma.deal.findUnique.mockResolvedValue(null);

      await service.handleDealWon(event);

      expect(prisma.client.create).not.toHaveBeenCalled();
    });

    it('no duplica el cliente si el evento se dispara dos veces para el mismo deal', async () => {
      const event = new DealWonEvent('deal-1');

      prisma.deal.findUnique.mockResolvedValue({
        id: 'deal-1',
        lead: { name: 'Samuel', email: 'samuel@test.com', phone: null },
      });
      prisma.client.findUnique.mockResolvedValue({ id: 'cliente-ya-existente' }); // ya existe

      await service.handleDealWon(event);

      expect(prisma.client.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna todos los clientes incluyendo su deal', async () => {
      await service.findAll();

      expect(prisma.client.findMany).toHaveBeenCalledWith({ include: { deal: true } });
    });
  });

  describe('findOne', () => {
    it('lanza NotFoundException si el cliente no existe', async () => {
      prisma.client.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        new NotFoundException('Cliente no-existe no encontrado'),
      );
    });
  });

  describe('update', () => {
    it('convierte installationDate de string a Date antes de guardar', async () => {
      const id = 'cliente-1';
      prisma.client.findUnique.mockResolvedValue({ id }); // para que pase el findOne interno

      await service.update(id, { installationDate: '2026-10-01' } as any);

      expect(prisma.client.update).toHaveBeenCalledWith({
        where: { id },
        data: expect.objectContaining({
          installationDate: new Date('2026-10-01'),
        }),
      });
    });
  });
});