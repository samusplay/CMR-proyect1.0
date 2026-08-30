import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DealWonEvent } from 'src/leads/events/deal-won.event';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';


@Injectable()
export class DealsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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
    return this.prisma.deal.findMany({ include: { lead: true } });
  }

  async findOne(id: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: { lead: true },
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
}