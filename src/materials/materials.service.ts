import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { FindMaterialsQueryDto } from './dto/find-materials-query.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';

@Injectable()
export class MaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMaterialDto) {
    try {
      return await this.prisma.material.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          description: dto.description.trim(),
          category: dto.category,
          unitCode: dto.unitCode.trim().toUpperCase(),
          unitPrice: dto.unitPrice,
        },
      });
    } catch (error) {
      this.rethrowDuplicateCode(error, dto.code);
    }
  }

  findAll(query: FindMaterialsQueryDto) {
    const where: Prisma.MaterialWhereInput = {
      category: query.category,
      active: query.active === undefined ? undefined : query.active === 'true',
    };

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.material.findMany({
      where,
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async findOne(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) {
      throw new NotFoundException(`Material ${id} no encontrado`);
    }
    return material;
  }

  async update(id: string, dto: UpdateMaterialDto) {
    await this.findOne(id);

    try {
      // Prisma ignora los campos undefined: solo se actualiza lo que viene en el body
      return await this.prisma.material.update({
        where: { id },
        data: {
          code: dto.code?.trim().toUpperCase(),
          description: dto.description?.trim(),
          category: dto.category,
          unitCode: dto.unitCode?.trim().toUpperCase(),
          unitPrice: dto.unitPrice,
          active: dto.active,
        },
      });
    } catch (error) {
      this.rethrowDuplicateCode(error, dto.code);
    }
  }

  // P2002 = violación de unique. Confiar en la base evita la carrera de "revisar y luego crear"
  private rethrowDuplicateCode(error: unknown, code?: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(`Ya existe un material con el código ${code?.trim().toUpperCase()}`);
    }
    throw error;
  }
}