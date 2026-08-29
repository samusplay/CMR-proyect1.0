import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateLeadDto) {
    // si mandan campaignId, confirmamos que esa campaña exista de verdad
    if (dto.campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: dto.campaignId },
      });

      if (!campaign) {
        throw new NotFoundException(`La campaña ${dto.campaignId} no existe`);
      }
    }

    return this.prisma.lead.create({ data: dto });
  }

  findAll() {
    return this.prisma.lead.findMany({
      include: { campaign: true, deal: true },
    });
  }

  async findOne(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: { campaign: true, deal: true },
    });

    if (!lead) {
      throw new NotFoundException(`Lead ${id} no encontrado`);
    }

    return lead;
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findOne(id);

    return this.prisma.lead.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.lead.delete({ where: { id } });
  }
}