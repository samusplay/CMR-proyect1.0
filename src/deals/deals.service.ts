import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateDealDto } from './dto/create-deal.dto';
import { DealResponseDto } from './dto/deal-response.dto';
import { UpdateDealDto } from './dto/update-deal.dto';

@Injectable()
export class DealsService {
  constructor(private prisma: PrismaService) {

  }
  async create(dto: CreateDealDto): Promise<DealResponseDto> {

    // 1. confirmar que el lead exista de verdad
    //Buscamos en la base de datos
    const lead = await this.prisma.lead.findUnique({
      where: { id: dto.leadId },
    });

    //Tiramos una expecion
    if (!lead) {
      throw new NotFoundException(`El lead ${dto.leadId} no existe`);
    }

    // 2. confirmar que ese lead no tenga ya una negociación
    const existingDeal = await this.prisma.deal.findUnique({
      where: { leadId: dto.leadId },
    });

    //si tiene una excepcion para el codigo
    if (existingDeal) {
      throw new ConflictException(`El lead ${dto.leadId} ya tiene una negociación abierta`);
    }


    //al create hay que pasarle el dto 
    return this.prisma.deal.create({
      data: dto
    });
  }

  findAll() {
    return this.prisma.deal.findMany({
      include: { lead: true } //Para ver nuestra consulta el Nombre del Trato
    });
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
    await this.findOne(id); // reutilizas la validación de que exista

    return this.prisma.deal.update({
      where: { id },
      data: dto,
    });
  }
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.deal.update({
      where: { id },
      data: { stage: 'PERDIDO' }, // soft delete a la manera de un CRM: no se borra, se marca como perdido
    });
  }


}
