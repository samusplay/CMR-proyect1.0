import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: any;
  let tx: any;

  // Fechas relativas a "hoy" para que el test no caduque con el tiempo
  const futureIso = (days = 7) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const buildAppointment = (overrides: Record<string, unknown> = {}) => ({
    id: 'appt-1',
    dealId: 'deal-1',
    status: AppointmentStatus.PROGRAMADA,
    inspectorId: 'inspector-1',
    notes: 'Llevar escalera',
    ...overrides,
  });

  beforeEach(async () => {
    // tx simula el cliente que recibe el callback de $transaction
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      inspectionAppointment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    prisma = {
      deal: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      inspectionAppointment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: unknown) => unknown) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppointmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseDto = () => ({ dealId: 'deal-1', scheduledAt: futureIso(), notes: 'Llevar escalera' });

    beforeEach(() => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1', inspection: null });
      tx.inspectionAppointment.findFirst.mockResolvedValue(null);
      tx.inspectionAppointment.create.mockResolvedValue({ id: 'appt-new' });
    });

    it('crea la cita tomando scheduledById del parámetro (el token), no del dto', async () => {
      const result = await service.create(baseDto(), 'user-1');

      expect(result).toEqual({ id: 'appt-new' });
      expect(tx.inspectionAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            scheduledById: 'user-1',
            notes: 'Llevar escalera',
          }),
        }),
      );
    });

    it('convierte la hora con zona horaria a UTC', async () => {
      await service.create({ dealId: 'deal-1', scheduledAt: '2099-10-15T09:00:00-05:00' }, 'user-1');

      const data = tx.inspectionAppointment.create.mock.calls[0][0].data;
      expect(data.scheduledAt).toBeInstanceOf(Date);
      expect(data.scheduledAt.toISOString()).toBe('2099-10-15T14:00:00.000Z');
    });

    it('rechaza una fecha pasada y no consulta la base', async () => {
      await expect(
        service.create({ dealId: 'deal-1', scheduledAt: '2020-01-01T09:00:00-05:00' }, 'user-1'),
      ).rejects.toThrow(new BadRequestException('La fecha de la cita debe ser futura'));

      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });

    it('rechaza un texto que no es una fecha', async () => {
      await expect(
        service.create({ dealId: 'deal-1', scheduledAt: 'mañana' }, 'user-1'),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.deal.findUnique).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el deal no existe, y nunca abre la transacción', async () => {
      prisma.deal.findUnique.mockResolvedValue(null);

      await expect(service.create(baseDto(), 'user-1')).rejects.toThrow(
        new NotFoundException('El deal deal-1 no existe'),
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el deal ya tiene una inspección realizada', async () => {
      prisma.deal.findUnique.mockResolvedValue({ id: 'deal-1', inspection: { id: 'insp-1' } });

      await expect(service.create(baseDto(), 'user-1')).rejects.toThrow(
        new ConflictException('El deal deal-1 ya tiene una inspección realizada'),
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('valida que el inspector exista cuando viene uno, y lo guarda', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'inspector-1' });

      await service.create({ ...baseDto(), inspectorId: 'inspector-1' }, 'user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'inspector-1' },
        select: { id: true },
      });
      expect(tx.inspectionAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inspectorId: 'inspector-1' }),
        }),
      );
    });

    it('lanza NotFoundException si el inspector no existe, sin abrir la transacción', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...baseDto(), inspectorId: 'ghost' }, 'user-1')).rejects.toThrow(
        new NotFoundException('El usuario ghost no existe'),
      );

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('no consulta usuarios si no se asigna inspector', async () => {
      await service.create(baseDto(), 'user-1');

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si el deal ya tiene una cita PROGRAMADA, y nunca crea', async () => {
      tx.inspectionAppointment.findFirst.mockResolvedValue({ id: 'open' });

      await expect(service.create(baseDto(), 'user-1')).rejects.toThrow(ConflictException);

      expect(tx.inspectionAppointment.findFirst).toHaveBeenCalledWith({
        where: { dealId: 'deal-1', status: AppointmentStatus.PROGRAMADA },
      });
      expect(tx.inspectionAppointment.create).not.toHaveBeenCalled();
    });

    it('bloquea la fila del deal ANTES de revisar si hay una cita abierta', async () => {
      await service.create(baseDto(), 'user-1');

      const lockOrder = tx.$queryRaw.mock.invocationCallOrder[0];
      const checkOrder = tx.inspectionAppointment.findFirst.mock.invocationCallOrder[0];
      expect(lockOrder).toBeLessThan(checkOrder);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.inspectionAppointment.findMany.mockResolvedValue([]);
    });

    it('ordena por fecha ascendente y no filtra por fecha si no se pide', async () => {
      await service.findAll({});

      const args = prisma.inspectionAppointment.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ scheduledAt: 'asc' });
      expect(args.where).not.toHaveProperty('scheduledAt');
    });

    it('convierte from y to en un rango de fechas', async () => {
      await service.findAll({ from: '2026-10-01T00:00:00Z', to: '2026-10-31T23:59:59Z' });

      const { where } = prisma.inspectionAppointment.findMany.mock.calls[0][0];
      expect(where.scheduledAt).toEqual({
        gte: new Date('2026-10-01T00:00:00Z'),
        lte: new Date('2026-10-31T23:59:59Z'),
      });
    });

    it('acepta solo from, sin límite superior', async () => {
      await service.findAll({ from: '2026-10-01T00:00:00Z' });

      const { where } = prisma.inspectionAppointment.findMany.mock.calls[0][0];
      expect(where.scheduledAt).toEqual({ gte: new Date('2026-10-01T00:00:00Z') });
    });

    it('filtra por dealId, inspectorId y status', async () => {
      await service.findAll({
        dealId: 'deal-1',
        inspectorId: 'inspector-1',
        status: AppointmentStatus.PROGRAMADA,
      });

      const { where } = prisma.inspectionAppointment.findMany.mock.calls[0][0];
      expect(where).toEqual({
        dealId: 'deal-1',
        inspectorId: 'inspector-1',
        status: AppointmentStatus.PROGRAMADA,
      });
    });

    it('lanza BadRequestException si from es posterior a to', () => {
      expect(() =>
        service.findAll({ from: '2026-10-31T00:00:00Z', to: '2026-10-01T00:00:00Z' }),
      ).toThrow(new BadRequestException('"from" no puede ser posterior a "to"'));

      expect(prisma.inspectionAppointment.findMany).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si una fecha del filtro es inválida', () => {
      expect(() => service.findAll({ from: 'basura' })).toThrow(BadRequestException);

      expect(prisma.inspectionAppointment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('devuelve la cita si existe', async () => {
      const appointment = buildAppointment();
      prisma.inspectionAppointment.findUnique.mockResolvedValue(appointment);

      const result = await service.findOne('appt-1');

      expect(result).toEqual(appointment);
      expect(prisma.inspectionAppointment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'appt-1' } }),
      );
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        new NotFoundException('Cita no-existe no encontrada'),
      );
    });

    it('nunca pide el password de los usuarios relacionados', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(buildAppointment());

      await service.findOne('appt-1');

      const { include } = prisma.inspectionAppointment.findUnique.mock.calls[0][0];
      for (const relation of ['inspector', 'scheduledBy', 'closedBy']) {
        expect(include[relation].select).toBeDefined();
        expect(include[relation].select).not.toHaveProperty('password');
      }
    });
  });

  describe('reschedule', () => {
    const dto = () => ({ scheduledAt: futureIso(10), reason: 'El cliente pidió otro día' });

    beforeEach(() => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(buildAppointment());
      tx.inspectionAppointment.updateMany.mockResolvedValue({ count: 1 });
      tx.inspectionAppointment.create.mockResolvedValue({ id: 'appt-2' });
    });

    it('cierra la cita vieja como REPROGRAMADA con motivo, quién y cuándo', async () => {
      await service.reschedule('appt-1', dto(), 'user-2');

      expect(tx.inspectionAppointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appt-1', status: AppointmentStatus.PROGRAMADA },
        data: {
          status: AppointmentStatus.REPROGRAMADA,
          reason: 'El cliente pidió otro día',
          closedById: 'user-2',
          closedAt: expect.any(Date),
        },
      });
    });

    it('crea una cita nueva que hereda deal, notas e inspector', async () => {
      const result = await service.reschedule('appt-1', dto(), 'user-2');

      expect(result).toEqual({ id: 'appt-2' });
      expect(tx.inspectionAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dealId: 'deal-1',
            scheduledById: 'user-2',
            inspectorId: 'inspector-1',
            notes: 'Llevar escalera',
          }),
        }),
      );
    });

    it('cierra la vieja ANTES de crear la nueva', async () => {
      await service.reschedule('appt-1', dto(), 'user-2');

      const closeOrder = tx.inspectionAppointment.updateMany.mock.invocationCallOrder[0];
      const createOrder = tx.inspectionAppointment.create.mock.invocationCallOrder[0];
      expect(closeOrder).toBeLessThan(createOrder);
    });

    it('usa el inspector nuevo si viene y valida que exista', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'inspector-2' });

      await service.reschedule('appt-1', { ...dto(), inspectorId: 'inspector-2' }, 'user-2');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'inspector-2' },
        select: { id: true },
      });
      expect(tx.inspectionAppointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ inspectorId: 'inspector-2' }),
        }),
      );
    });

    it('lanza NotFoundException si el inspector nuevo no existe, sin abrir la transacción', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.reschedule('appt-1', { ...dto(), inspectorId: 'ghost' }, 'user-2'),
      ).rejects.toThrow(new NotFoundException('El usuario ghost no existe'));

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si la cita no está PROGRAMADA', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(
        buildAppointment({ status: AppointmentStatus.CANCELADA }),
      );

      await expect(service.reschedule('appt-1', dto(), 'user-2')).rejects.toThrow(ConflictException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si otra persona se adelantó (count 0), y nunca crea', async () => {
      tx.inspectionAppointment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reschedule('appt-1', dto(), 'user-2')).rejects.toThrow(ConflictException);

      expect(tx.inspectionAppointment.create).not.toHaveBeenCalled();
    });

    it('rechaza una fecha pasada sin consultar la cita', async () => {
      await expect(
        service.reschedule(
          'appt-1',
          { scheduledAt: '2020-01-01T09:00:00-05:00', reason: 'x' },
          'user-2',
        ),
      ).rejects.toThrow(new BadRequestException('La fecha de la cita debe ser futura'));

      expect(prisma.inspectionAppointment.findUnique).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si la cita no existe', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(null);

      await expect(service.reschedule('appt-1', dto(), 'user-2')).rejects.toThrow(
        new NotFoundException('Cita appt-1 no encontrada'),
      );
    });
  });

  describe('cancel', () => {
    it('pasa a CANCELADA guardando motivo, quién y cuándo', async () => {
      prisma.inspectionAppointment.findUnique
        .mockResolvedValueOnce(buildAppointment())
        .mockResolvedValueOnce(buildAppointment({ status: AppointmentStatus.CANCELADA }));
      prisma.inspectionAppointment.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.cancel('appt-1', { reason: 'Cliente no disponible' }, 'user-3');

      expect(prisma.inspectionAppointment.updateMany).toHaveBeenCalledWith({
        where: { id: 'appt-1', status: AppointmentStatus.PROGRAMADA },
        data: {
          status: AppointmentStatus.CANCELADA,
          reason: 'Cliente no disponible',
          closedById: 'user-3',
          closedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(AppointmentStatus.CANCELADA);
    });

    it('lanza ConflictException si la cita no está PROGRAMADA, y no actualiza nada', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(
        buildAppointment({ status: AppointmentStatus.CANCELADA }),
      );

      await expect(service.cancel('appt-1', { reason: 'otra vez' }, 'user-3')).rejects.toThrow(
        ConflictException,
      );

      expect(prisma.inspectionAppointment.updateMany).not.toHaveBeenCalled();
    });

    it('lanza ConflictException si otra persona se adelantó (count 0)', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(buildAppointment());
      prisma.inspectionAppointment.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.cancel('appt-1', { reason: 'x' }, 'user-3')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lanza NotFoundException si la cita no existe', async () => {
      prisma.inspectionAppointment.findUnique.mockResolvedValue(null);

      await expect(service.cancel('appt-1', { reason: 'x' }, 'user-3')).rejects.toThrow(
        NotFoundException,
      );

      expect(prisma.inspectionAppointment.updateMany).not.toHaveBeenCalled();
    });
  });
});