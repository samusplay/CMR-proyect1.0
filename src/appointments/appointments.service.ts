import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { FindAppointmentsQueryDto } from './dto/find-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

// Con select a propósito: un include: { inspector: true } devolvería el hash de la contraseña
const appointmentInclude = {
  deal: {
    select: {
      id: true,
      stage: true,
      installationType: true,
      lead: { select: { id: true, name: true, email: true, phone: true } },
    },
  },
  inspector: { select: { id: true, name: true, email: true } },
  scheduledBy: { select: { id: true, name: true, email: true } },
  closedBy: { select: { id: true, name: true, email: true } }, //campo en la base de datos llamado de prisma
} satisfies Prisma.InspectionAppointmentInclude;

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAppointmentDto, scheduledById: string) {
    const scheduledAt = this.parseFutureDate(dto.scheduledAt);

    const deal = await this.prisma.deal.findUnique({
      where: { id: dto.dealId },
      include: { inspection: { select: { id: true } } },
    });
    if (!deal) {
      throw new NotFoundException(`El deal ${dto.dealId} no existe`);
    }
    if (deal.inspection) {
      throw new ConflictException(`El deal ${dto.dealId} ya tiene una inspección realizada`);
    }

    if (dto.inspectorId) {
      await this.assertUserExists(dto.inspectorId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Bloquea la fila del deal: si dos personas agendan a la vez, la segunda espera
      // a que termine la primera y entonces sí ve la cita ya creada
      await this.lockDeal(tx, dto.dealId);

      const open = await tx.inspectionAppointment.findFirst({
        where: { dealId: dto.dealId, status: AppointmentStatus.PROGRAMADA },
      });
      if (open) {
        throw new ConflictException(
          `El deal ${dto.dealId} ya tiene una cita programada. Reprográmala en vez de crear otra`,
        );
      }

      return tx.inspectionAppointment.create({
        data: {
          dealId: dto.dealId,
          scheduledAt,
          inspectorId: dto.inspectorId,
          scheduledById,
          notes: dto.notes,
        },
        include: appointmentInclude,
      });
    });
  }

  findAll(query: FindAppointmentsQueryDto) {
    const from = query.from ? this.parseDate(query.from) : undefined;
    const to = query.to ? this.parseDate(query.to) : undefined;

    if (from && to && from > to) {
      throw new BadRequestException('"from" no puede ser posterior a "to"');
    }

    const where: Prisma.InspectionAppointmentWhereInput = {
      dealId: query.dealId,
      inspectorId: query.inspectorId,
      status: query.status,
      ...(from || to ? { scheduledAt: { gte: from, lte: to } } : {}),
    };

    return this.prisma.inspectionAppointment.findMany({
      where,
      include: appointmentInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const appointment = await this.prisma.inspectionAppointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
    if (!appointment) {
      throw new NotFoundException(`Cita ${id} no encontrada`);
    }
    return appointment;
  }

  // Reprogramar no edita la cita: cierra la vieja (REPROGRAMADA) y crea una nueva,
  // así queda el historial completo con su motivo y quién tomó cada decisión
  async reschedule(id: string, dto: RescheduleAppointmentDto, userId: string) {
    const scheduledAt = this.parseFutureDate(dto.scheduledAt);
    const current = await this.findOne(id);

    if (current.status !== AppointmentStatus.PROGRAMADA) {
      throw new ConflictException(
        `Solo se puede reprogramar una cita PROGRAMADA (actual: ${current.status})`,
      );
    }
    if (dto.inspectorId) {
      await this.assertUserExists(dto.inspectorId);
    }

    return this.prisma.$transaction(async (tx) => {
      // Cierra la vieja solo si sigue PROGRAMADA: si otra persona se adelantó, count será 0
      const { count } = await tx.inspectionAppointment.updateMany({
        where: { id, status: AppointmentStatus.PROGRAMADA },
        data: {
          status: AppointmentStatus.REPROGRAMADA,
          reason: dto.reason,
          closedById: userId, 
          closedAt: new Date(), 
        },
      });
      if (count === 0) {
        throw new ConflictException('La cita ya fue modificada por otra persona. Actualiza e intenta de nuevo');
      }

      return tx.inspectionAppointment.create({
        data: {
          dealId: current.dealId,
          scheduledAt,
          inspectorId: dto.inspectorId ?? current.inspectorId,
          scheduledById: userId,
          notes: current.notes,
        },
        include: appointmentInclude,
      });
    });
  }

  async cancel(id: string, dto: CancelAppointmentDto, userId: string) {
    const current = await this.findOne(id);

    if (current.status !== AppointmentStatus.PROGRAMADA) {
      throw new ConflictException(
        `Solo se puede cancelar una cita PROGRAMADA (actual: ${current.status})`,
      );
    }

    const { count } = await this.prisma.inspectionAppointment.updateMany({
      where: { id, status: AppointmentStatus.PROGRAMADA },
      data: {
        status: AppointmentStatus.CANCELADA,
        reason: dto.reason,
        closedById: userId, 
        closedAt: new Date(),
      },
    });
    if (count === 0) {
      throw new ConflictException('La cita ya fue modificada por otra persona. Actualiza e intenta de nuevo');
    }

    return this.findOne(id);
  }

  // --- privados ---

  private lockDeal(tx: Prisma.TransactionClient, dealId: string) {
    return tx.$queryRaw`SELECT id FROM "Deal" WHERE id = ${dealId} FOR UPDATE`;
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new NotFoundException(`El usuario ${userId} no existe`);
    }
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(`Fecha inválida: ${value}`);
    }
    return date;
  }

  private parseFutureDate(value: string): Date {
    const date = this.parseDate(value);
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('La fecha de la cita debe ser futura');
    }
    return date;
  }
}