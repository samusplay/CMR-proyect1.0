import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { DealWonEvent } from '../leads/events/deal-won.event';
import { OfferStatusChangedEvent } from '../offers/events/offer-status-changed.event';
import { PrismaService } from '../prisma/prisma.service';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';


describe('DealsService', () => {
  let service: DealsService;
  let prisma: any;
  let eventEmitter: any;

  beforeEach(async () => {
    prisma = {
      lead: { findUnique: jest.fn() },
      deal: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<DealsService>(DealsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea una negociación si el lead existe y no tiene deal previo', async () => {
      const dto = {
        leadId: 'lead-1',
        installationType: 'SOLAR',
        estimatedValue: 8500000,
        expectedCloseDate: '2026-12-31',
      } as CreateDealDto;

      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      prisma.deal.findUnique.mockResolvedValue(null);
      prisma.deal.create.mockResolvedValue({ id: 'deal-1', ...dto });

      await service.create(dto);

      expect(prisma.deal.create).toHaveBeenCalledWith({
        data: {
          ...dto,
          expectedCloseDate: new Date('2026-12-31'),
        },
      });
    });

    it('lanza NotFoundException si el lead no existe, y nunca intenta crear el deal', async () => {
      const dto = { leadId: 'lead-fantasma' } as CreateDealDto;
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(
        new NotFoundException('El lead lead-fantasma no existe'),
      );

      expect(prisma.deal.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el lead ya tiene un deal abierto', async () => {
      const dto = { leadId: 'lead-1' } as CreateDealDto;
      prisma.lead.findUnique.mockResolvedValue({ id: 'lead-1' });
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-previo', leadId: 'lead-1' });

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('El lead lead-1 ya tiene una negociación abierta'),
      );

      expect(prisma.deal.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('retorna todos los deals incluyendo su lead y su inspección', async () => {
      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-1', lead: { id: 'lead-1' } }]);

      const result = await service.findAll();

      expect(prisma.deal.findMany).toHaveBeenCalledWith({ include: { lead: true, inspection: true } });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('retorna un deal específico por id', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1' });

      await service.findOne('deal-1');

      expect(prisma.deal.findUnique).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        include: { lead: true, inspection: true },
      });
    });

    it('lanza NotFoundException si no encuentra el deal', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(service.findOne('deal-404')).rejects.toThrow(
        new NotFoundException('Deal deal-404 no encontrado'),
      );
    });
  });

  describe('update', () => {
    it('ignora un leadId inyectado en el body y emite deal.won al pasar a GANADO', async () => {
      const id = 'deal-1';
      const dto = { stage: 'GANADO', leadId: 'intento-de-hackeo' } as UpdateDealDto;
      const existingDeal = { id, stage: 'PROPUESTA' };

      prisma.deal.findUnique.mockResolvedValue(existingDeal);
      prisma.deal.update.mockResolvedValue({ id, stage: 'GANADO' });

      await service.update(id, dto);

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id },
        data: {
          stage: 'GANADO',
          expectedCloseDate: undefined,
        },
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('deal.won', expect.any(DealWonEvent));
    });

    it('NO emite el evento si el nuevo stage no es GANADO', async () => {
      const id = 'deal-1';
      const dto = { stage: 'CONTACTADO' } as UpdateDealDto;

      prisma.deal.findUnique.mockResolvedValue({ id, stage: 'PROPUESTA' });
      prisma.deal.update.mockResolvedValue({ id, stage: 'CONTACTADO' });

      await service.update(id, dto);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('NO vuelve a emitir el evento si el deal YA estaba en GANADO', async () => {
      const id = 'deal-1';
      const dto = { stage: 'GANADO' } as UpdateDealDto;

      prisma.deal.findUnique.mockResolvedValue({ id, stage: 'GANADO' });
      prisma.deal.update.mockResolvedValue({ id, stage: 'GANADO' });

      await service.update(id, dto);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('cambia el stage a PERDIDO en vez de borrar', async () => {
      const id = 'deal-1';
      prisma.deal.findUnique.mockResolvedValue({ id });
      prisma.deal.update.mockResolvedValue({ id, stage: 'PERDIDO' });

      await service.remove(id);

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id },
        data: { stage: 'PERDIDO' },
      });
    });
  });

  describe('handleOfferStatusChanged', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation();
      errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('oferta ENVIADA: el deal pasa a PROPUESTA', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1', stage: 'NUEVO' });
      prisma.deal.update.mockResolvedValue({ id: 'deal-1', stage: 'PROPUESTA' });

      await service.handleOfferStatusChanged(new OfferStatusChangedEvent('offer-1', 'deal-1', 'ENVIADA'));

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: { stage: 'PROPUESTA', expectedCloseDate: undefined },
      });
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('oferta ACEPTADA: el deal pasa a GANADO y se emite deal.won (que crea el cliente)', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1', stage: 'PROPUESTA' });
      prisma.deal.update.mockResolvedValue({ id: 'deal-1', stage: 'GANADO' });

      await service.handleOfferStatusChanged(new OfferStatusChangedEvent('offer-1', 'deal-1', 'ACEPTADA'));

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: { stage: 'GANADO', expectedCloseDate: undefined },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('deal.won', expect.any(DealWonEvent));
    });

    it('oferta RECHAZADA o de vuelta a BORRADOR: el deal no se mueve', async () => {
      await service.handleOfferStatusChanged(new OfferStatusChangedEvent('offer-1', 'deal-1', 'RECHAZADA'));
      await service.handleOfferStatusChanged(new OfferStatusChangedEvent('offer-1', 'deal-1', 'BORRADOR'));

      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
      expect(prisma.deal.update).not.toHaveBeenCalled();
    });

    it('si falla (por ejemplo, el deal no existe), registra el error y NO lo propaga', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(
        service.handleOfferStatusChanged(new OfferStatusChangedEvent('offer-1', 'deal-404', 'ACEPTADA')),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(prisma.deal.update).not.toHaveBeenCalled();
    });
  });
});