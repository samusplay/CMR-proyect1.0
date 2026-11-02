import { MaterialCategory } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class FindMaterialsQueryDto {
  @IsEnum(MaterialCategory, { message: 'La categoría no es válida' })
  @IsOptional()
  category?: MaterialCategory;

  // En la URL todo llega como texto, por eso 'true' | 'false' y no boolean
  @IsIn(['true', 'false'], { message: 'active debe ser true o false' })
  @IsOptional()
  active?: 'true' | 'false';

  @IsString({ message: 'La búsqueda debe ser un texto' })
  @IsOptional()
  search?: string;
}