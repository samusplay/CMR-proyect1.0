import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dtos/create-inspection.dto';
import { UpdateInspectionDto } from './dtos/update-inspection.dto';

@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInspectionDto) {
    await this.validateDealForInspection(dto.dealId);

    return this.prisma.inspection.create({ data: dto });
  }

  findAll() {
    return this.prisma.inspection.findMany({ include: { deal: true } });
  }

  async findOne(id: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      include: { deal: true },
    });

    if (!inspection) {
      throw new NotFoundException(`Inspección ${id} no encontrada`);
    }

    return inspection;
  }

  async update(id: string, dto: UpdateInspectionDto) {
    await this.findOne(id);

    // dealId nunca se puede reasignar desde un update
    const { dealId, ...safeData } = dto;

    return this.prisma.inspection.update({
      where: { id },
      data: {
        ...safeData,
        approvedAt: dto.status === 'APROBADA' ? new Date() : undefined,
      },
    });
  }

  // --- privado: agrupa las dos reglas de negocio del create en un solo lugar ---
  private async validateDealForInspection(dealId: string) {
    const deal = await this.prisma.deal.findUnique({ where: { id: dealId } });

    if (!deal) {
      throw new NotFoundException(`El deal ${dealId} no existe`);
    }

    const existingInspection = await this.prisma.inspection.findUnique({ where: { dealId } });

    if (existingInspection) {
      throw new ConflictException(`El deal ${dealId} ya tiene una inspección registrada`);
    }
  }
}