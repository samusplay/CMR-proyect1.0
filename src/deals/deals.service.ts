import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { DealStage, OfferStatus } from '@prisma/client';
import { DealWonEvent } from '../leads/events/deal-won.event';
import { OFFER_STATUS_CHANGED_EVENT, OfferStatusChangedEvent } from '../offers/events/offer-status-changed.event';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

// Cómo avanza el deal cuando cambia su oferta. Los estados que no aparecen no mueven el deal
const STAGE_BY_OFFER_STATUS: Partial<Record<OfferStatus, DealStage>> = {
  ENVIADA: 'PROPUESTA',
  ACEPTADA: 'GANADO',
};

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) { }

  async create(dto: CreateDealDto) {
    const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId } });
    if (!lead) {
      throw new NotFoundException(`El lead ${dto.leadId} no existe`);
    }

    const existingDeal = await this.prisma.deal.findUnique({ where: { leadId: dto.leadId } });
    if (existingDeal) {
      throw new ConflictException(`El lead ${dto.leadId} ya tiene una negociación abierta`);
    }

    return this.prisma.deal.create({
      data: {
        ...dto,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      },
    });
  }

  findAll() {
    return this.prisma.deal.findMany({ include: { lead: true, inspection: true } });
  }

  async findOne(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { lead: true, inspection: true },
    });

    if (!deal) {
      throw new NotFoundException(`Deal ${id} no encontrado`);
    }

    return deal;
  }

  async update(id: string, dto: UpdateDealDto) {
    const existing = await this.findOne(id);

    // no permitimos reasignar el leadId desde un update — eso solo se decide al crear
    const { leadId, ...safeData } = dto;

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        ...safeData,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
      },
    });

    if (dto.stage === 'GANADO' && existing.stage !== 'GANADO') {
      this.eventEmitter.emit('deal.won', new DealWonEvent(updated.id));
    }

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.deal.update({
      where: { id },
      data: { stage: 'PERDIDO' },
    });
  }

  // La oferta mueve el deal: enviada → PROPUESTA; aceptada → GANADO (y deal.won crea el cliente).
  // try/catch a propósito: si esto falla, el cambio de la oferta ya quedó guardado y no debe romperse
  @OnEvent(OFFER_STATUS_CHANGED_EVENT)
  async handleOfferStatusChanged(event: OfferStatusChangedEvent) {
    const stage = STAGE_BY_OFFER_STATUS[event.status];
    if (!stage) {
      return;
    }

    try {
      await this.update(event.dealId, { stage });
      this.logger.log(`Deal ${event.dealId} pasó a ${stage} (oferta ${event.offerId} ${event.status})`);
    } catch (error) {
      this.logger.error(
        `No se pudo mover el deal ${event.dealId} a ${stage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}