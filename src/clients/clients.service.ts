import { Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from 'src/prisma/prisma.service';

import { DealWonEvent } from 'src/leads/events/deal-won.event';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  @OnEvent('deal.won')
  async handleDealWon(event: DealWonEvent) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: event.dealId },
      include: { lead: true },
    });

    if (!deal) return;

    const alreadyExists = await this.prisma.client.findUnique({
      where: { dealId: deal.id },
    });
    if (alreadyExists) return;

    await this.prisma.client.create({
      data: {
        name: deal.lead.name,
        email: deal.lead.email,
        phone: deal.lead.phone,
        dealId: deal.id,
      },
    });
  }

  findAll() {
    return this.prisma.client.findMany({ include: { deal: true } });
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: { deal: true },
    });
    if (!client) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto) {
    await this.findOne(id);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...dto,
        installationDate: dto.installationDate ? new Date(dto.installationDate) : undefined,
      },
    });
  }
}