import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInspectionDto } from './dtos/create-inspection.dto';
import { UpdateInspectionDto } from './dtos/update-inspection.dto';


@Injectable()
export class InspectionsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateInspectionDto) {
    await this.validateClientForInspection(dto.clientId);

    return this.prisma.inspection.create({ data: dto });
  }

  findAll() {
    return this.prisma.inspection.findMany({ include: { client: true } });
  }

  async findOne(id: string) {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id },
      include: { client: true },
    });

    if (!inspection) {
      throw new NotFoundException(`Inspección ${id} no encontrada`);
    }

    return inspection;
  }

  async update(id: string, dto: UpdateInspectionDto) {
    await this.findOne(id);

    // clientId nunca se puede reasignar desde un update
    const { clientId, ...safeData } = dto;

    return this.prisma.inspection.update({
      where: { id },
      data: {
        ...safeData,
        // si la están aprobando justo ahora, sella la fecha automáticamente
        approvedAt: dto.status === 'APROBADA' ? new Date() : undefined,
      },
    });
  }

  // --- privado: agrupa las dos reglas de negocio del create en un solo lugar ---
  private async validateClientForInspection(clientId: string) {
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });

    if (!client) {
      throw new NotFoundException(`El cliente ${clientId} no existe`);
    }

    const existingInspection = await this.prisma.inspection.findUnique({ where: { clientId } });

    if (existingInspection) {
      throw new ConflictException(`El cliente ${clientId} ya tiene una inspección registrada`);
    }
  }
}