import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OFFER_STATUS_CHANGED_EVENT, OfferStatusChangedEvent } from './events/offer-status-changed.event';
import { OffersService } from './offers.service';

describe('OffersService', () => {
  let service: OffersService;
  let prisma: any;
  let eventEmitter: { emit: jest.Mock };

  const year = new Date().getFullYear();

  // Inspección completa y aprobada: la misma que se usó en Postman
  const approvedInspection = {
    id: 'insp-1',
    status: 'APROBADA',
    systemType: 'MONOFASICO',
    cableLength: 10,
    cableGauge: '8 AWG',
    conduitLength: 8,
    conduitType: 'EMT',
    chargerModel: 'Wallbox Pulsar',
    chargerMountType: 'ADOSADO_A_MURO',
    anchorType: 'CHAZOS',
    differentialProtectionRequired: true,
    differentialType: null,
    requiresDrilling: true,
    drillingLocation: 'muro del parqueadero',
  };

  const buildDeal = (overrides: Record<string, unknown> = {}) => ({
    id: 'deal-1',
    offer: null,
    lead: { name: 'Carlos Gómez' },
    inspection: approvedInspection,
    ...overrides,
  });

  // Catálogo con los códigos escritos distinto a como los arma la regla, para probar la normalización
  const material = (id: string, code: string, unitPrice: number, unitCode = 'UN') => ({
    id,
    code,
    description: `Material ${code}`,
    unitCode,
    unitPrice,
    active: true,
  });

  const fullCatalog = [
    material('m-cgr', 'CGR-WALLBOX-PULSAR', 2800000),
    material('m-mnt', 'MNT-MURO', 120000),
    material('m-cab', 'CAB-8AWG', 5200, 'ML'),
    material('m-can', 'CAN-EMT', 9500, 'ML'),
    material('m-anc', 'ANC-CHAZOS', 25000),
    material('m-pro', 'PRO-DIFERENCIAL', 180000),
    material('m-per', 'MOB-PERFORACION', 60000),
    material('m-ins', 'MOB-INSTALACION', 350000),
  ];

  const buildOffer = (overrides: Record<string, unknown> = {}) => ({
    id: 'offer-1',
    dealId: 'deal-1',
    status: 'BORRADOR',
    aiuPercentage: 0.15,
    ivaPercentage: 0.19,
    items: [
      { lineNumber: 1, quantity: 1, unitPrice: 350000 },
      { lineNumber: 2, quantity: 10, unitPrice: 5200 },
    ],
    ...overrides,
  });

  const uniqueError = (target: string[]) =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target },
    });

  beforeEach(async () => {
    prisma = {
      deal: { findUnique: jest.fn() },
      material: { findMany: jest.fn() },
      offer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('generateFromInspection', () => {
    beforeEach(() => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal());
      prisma.material.findMany.mockResolvedValue(fullCatalog);
      prisma.offer.findFirst.mockResolvedValue(null);
      // Devuelve lo que se le pidió crear, como haría la base
      prisma.offer.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'offer-1',
          ...data,
          status: 'BORRADOR',
          aiuPercentage: 0.15,
          ivaPercentage: 0.19,
          items: data.items.create,
        }),
      );
    });

    it('lanza NotFoundException si el deal no existe, y nunca crea', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(service.generateFromInspection({ dealId: 'deal-404' })).rejects.toThrow(
        new NotFoundException('El deal deal-404 no existe'),
      );
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el deal ya tiene una oferta', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal({ offer: { id: 'offer-previa' } }));

      await expect(service.generateFromInspection({ dealId: 'deal-1' })).rejects.toThrow(
        new ConflictException('El deal deal-1 ya tiene una oferta'),
      );
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el deal no tiene inspección', async () => {
      prisma.deal.findUnique.mockResolvedValue(buildDeal({ inspection: null }));

      await expect(service.generateFromInspection({ dealId: 'deal-1' })).rejects.toThrow(
        new ConflictException('El deal deal-1 no tiene una inspección registrada'),
      );
    });

    it('lanza ConflictException si la inspección no está APROBADA, diciendo su estado', async () => {
      prisma.deal.findUnique.mockResolvedValue(
        buildDeal({ inspection: { ...approvedInspection, status: 'PENDIENTE' } }),
      );

      await expect(service.generateFromInspection({ dealId: 'deal-1' })).rejects.toThrow(
        new ConflictException('La inspección debe estar APROBADA para generar la oferta (actual: PENDIENTE)'),
      );
      expect(prisma.offer.create).not.toHaveBeenCalled();
    });

    it('con el catálogo completo genera las 8 líneas con precio y sin avisos', async () => {
      const result = await service.generateFromInspection({ dealId: 'deal-1' });

      const items = prisma.offer.create.mock.calls[0][0].data.items.create;
      expect(items.map((item) => item.materialId)).toEqual([
        'm-cgr', 'm-mnt', 'm-cab', 'm-can', 'm-anc', 'm-pro', 'm-per', 'm-ins',
      ]);
      expect(items.map((item) => item.lineNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(items.every((item) => item.unitPrice > 0)).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it('copia del catálogo la descripción, la unidad y el precio, y calcula la cantidad de cable', async () => {
      await service.generateFromInspection({ dealId: 'deal-1' });

      const cable = prisma.offer.create.mock.calls[0][0].data.items.create[2];
      expect(cable).toEqual({
        lineNumber: 3,
        materialId: 'm-cab',
        unitCode: 'ML',
        description: 'Material CAB-8AWG',
        quantity: 30, // 10 m × 3 conductores (monofásico)
        unitPrice: 5200,
        groupLabel: 'Cableado',
      });
    });

    it('calcula los totales y pone el título con el nombre del lead', async () => {
      const result = await service.generateFromInspection({ dealId: 'deal-1' });

      expect(result.title).toBe('Oferta de instalación para Carlos Gómez');
      expect(result.totals).toEqual({ subtotal: 3767000, aiu: 565050, iva: 823090, total: 5155140 });
    });

    it('si un material no está en el catálogo, deja la línea en precio 0 y avisa qué código buscó', async () => {
      prisma.material.findMany.mockResolvedValue(fullCatalog.filter((m) => m.code !== 'CAB-8AWG'));

      const result = await service.generateFromInspection({ dealId: 'deal-1' });

      const cable = prisma.offer.create.mock.calls[0][0].data.items.create[2];
      expect(cable.unitPrice).toBe(0);
      expect(cable.materialId).toBeUndefined();
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('CAB-8 AWG');
    });

    it('solo busca materiales activos', async () => {
      await service.generateFromInspection({ dealId: 'deal-1' });

      expect(prisma.material.findMany).toHaveBeenCalledWith({ where: { active: true } });
    });

    it('la primera oferta del año es la 0001', async () => {
      await service.generateFromInspection({ dealId: 'deal-1' });

      expect(prisma.offer.create.mock.calls[0][0].data.offerNumber).toBe(`OF-${year}-0001`);
    });

    it('el número sigue al último del año', async () => {
      prisma.offer.findFirst.mockResolvedValue({ offerNumber: `OF-${year}-0007` });

      await service.generateFromInspection({ dealId: 'deal-1' });

      expect(prisma.offer.create.mock.calls[0][0].data.offerNumber).toBe(`OF-${year}-0008`);
    });

    it('si el número choca con otra oferta creada al mismo tiempo, reintenta', async () => {
      const original = prisma.offer.create.getMockImplementation();
      prisma.offer.create
        .mockRejectedValueOnce(uniqueError(['offerNumber']))
        .mockImplementation(original);

      await service.generateFromInspection({ dealId: 'deal-1' });

      expect(prisma.offer.create).toHaveBeenCalledTimes(2);
    });

    it('si choca el dealId (otra oferta para el mismo deal), responde que ya tiene oferta', async () => {
      prisma.offer.create.mockRejectedValue(uniqueError(['dealId']));

      await expect(service.generateFromInspection({ dealId: 'deal-1' })).rejects.toThrow(
        new ConflictException('El deal deal-1 ya tiene una oferta'),
      );
      expect(prisma.offer.create).toHaveBeenCalledTimes(1);
    });

    it('no esconde otros errores de la base', async () => {
      prisma.offer.create.mockRejectedValue(new Error('db caída'));

      await expect(service.generateFromInspection({ dealId: 'deal-1' })).rejects.toThrow('db caída');
    });
  });

  describe('findAll', () => {
    it('filtra por estado y deal, ordena por las más recientes y agrega los totales', async () => {
      prisma.offer.findMany.mockResolvedValue([buildOffer()]);

      const result = await service.findAll({ status: 'BORRADOR', dealId: 'deal-1' });

      const args = prisma.offer.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ status: 'BORRADOR', dealId: 'deal-1' });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
      expect(result[0].totals.subtotal).toBe(402000);
    });
  });

  describe('findOne', () => {
    it('devuelve la oferta con sus totales', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer());

      const result = await service.findOne('offer-1');

      expect(result.totals).toEqual({ subtotal: 402000, aiu: 60300, iva: 87837, total: 550137 });
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('offer-404')).rejects.toThrow(
        new NotFoundException('Oferta offer-404 no encontrada'),
      );
    });
  });

  describe('update', () => {
    it('corrige solo lo que viene, con el título sin espacios sobrantes', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer());
      prisma.offer.update.mockResolvedValue(buildOffer({ warranty: '12 meses' }));

      await service.update('offer-1', { title: '  Oferta nueva ', warranty: '12 meses' });

      const { data } = prisma.offer.update.mock.calls[0][0];
      expect(data).toEqual({ title: 'Oferta nueva', warranty: '12 meses' });
    });

    it('lanza ConflictException si la oferta ya no está en BORRADOR, y no la toca', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer({ status: 'ENVIADA' }));

      await expect(service.update('offer-1', { warranty: 'x' })).rejects.toThrow(
        new ConflictException('Solo se puede editar una oferta en BORRADOR (actual: ENVIADA)'),
      );
      expect(prisma.offer.update).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    beforeEach(() => {
      prisma.offer.updateMany.mockResolvedValue({ count: 1 });
    });

    it('envía la oferta: cambia el estado y avisa al resto del sistema', async () => {
      prisma.offer.findUnique
        .mockResolvedValueOnce(buildOffer())
        .mockResolvedValueOnce(buildOffer({ status: 'ENVIADA' }));

      const result = await service.changeStatus('offer-1', { status: 'ENVIADA' });

      expect(prisma.offer.updateMany).toHaveBeenCalledWith({
        where: { id: 'offer-1', status: 'BORRADOR' },
        data: { status: 'ENVIADA' },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OFFER_STATUS_CHANGED_EVENT,
        new OfferStatusChangedEvent('offer-1', 'deal-1', 'ENVIADA'),
      );
      expect(result.status).toBe('ENVIADA');
    });

    it('acepta una oferta enviada y avisa con el estado ACEPTADA', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer({ status: 'ENVIADA' }));

      await service.changeStatus('offer-1', { status: 'ACEPTADA' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        OFFER_STATUS_CHANGED_EVENT,
        new OfferStatusChangedEvent('offer-1', 'deal-1', 'ACEPTADA'),
      );
    });

    it('lanza ConflictException si la transición no está permitida, sin cambiar ni avisar', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer());

      await expect(service.changeStatus('offer-1', { status: 'ACEPTADA' })).rejects.toThrow(
        new ConflictException('No se puede pasar una oferta de BORRADOR a ACEPTADA'),
      );
      expect(prisma.offer.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('no deja enviar una oferta con líneas en precio 0', async () => {
      prisma.offer.findUnique.mockResolvedValue(
        buildOffer({ items: [{ lineNumber: 1, quantity: 1, unitPrice: 0 }] }),
      );

      await expect(service.changeStatus('offer-1', { status: 'ENVIADA' })).rejects.toThrow(
        new ConflictException('La oferta tiene líneas con precio 0. Complétalas antes de enviarla'),
      );
      expect(prisma.offer.updateMany).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('si otra persona la cambió mientras tanto (count 0), responde 409 y no avisa', async () => {
      prisma.offer.findUnique.mockResolvedValue(buildOffer());
      prisma.offer.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.changeStatus('offer-1', { status: 'ENVIADA' })).rejects.toThrow(
        new ConflictException('La oferta fue modificada por otra persona. Actualiza e intenta de nuevo'),
      );
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la oferta no existe', async () => {
      prisma.offer.findUnique.mockResolvedValue(null);

      await expect(service.changeStatus('offer-404', { status: 'ENVIADA' })).rejects.toThrow(
        new NotFoundException('Oferta offer-404 no encontrada'),
      );
    });
  });
});