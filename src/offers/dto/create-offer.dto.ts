import { Type } from 'class-transformer';
import {
    ArrayMinSize,
    IsArray,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Matches,
    Max,
    Min,
    ValidateNested,
} from 'class-validator';
import { CreateOfferItemDto } from './create-offer-item.dto';

export class CreateOfferDto {
  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsNotEmpty({ message: 'El id del deal es obligatorio' })
  dealId!: string;

  @IsString({ message: 'El título debe ser un texto' })
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @Matches(/\S/, { message: 'El título no puede estar vacío' })
  title!: string;

  // Fracción entre 0 y 1: 0.15 = 15 %
  @IsNumber({}, { message: 'El AIU debe ser un número' })
  @Min(0, { message: 'El AIU no puede ser negativo' })
  @Max(1, { message: 'El AIU es una fracción entre 0 y 1 (0.15 = 15 %)' })
  @IsOptional()
  aiuPercentage?: number;

  @IsNumber({}, { message: 'El IVA debe ser un número' })
  @Min(0, { message: 'El IVA no puede ser negativo' })
  @Max(1, { message: 'El IVA es una fracción entre 0 y 1 (0.19 = 19 %)' })
  @IsOptional()
  ivaPercentage?: number;

  @IsString({ message: 'El tiempo de entrega debe ser un texto' })
  @IsOptional()
  deliveryTime?: string;

  @IsString({ message: 'La condición de entrega debe ser un texto' })
  @IsOptional()
  deliveryCondition?: string;

  @IsString({ message: 'La garantía debe ser un texto' })
  @IsOptional()
  warranty?: string;

  @IsString({ message: 'La forma de pago debe ser un texto' })
  @IsOptional()
  paymentTerms?: string;

  @IsInt({ message: 'La vigencia debe ser un número entero de días' })
  @IsPositive({ message: 'La vigencia debe ser mayor a cero' })
  @IsOptional()
  validityDays?: number;

  @IsArray({ message: 'Las líneas deben ser una lista' })
  @ArrayMinSize(1, { message: 'La oferta necesita al menos una línea' })
  @ValidateNested({ each: true })
  @Type(() => CreateOfferItemDto)
  items!: CreateOfferItemDto[];
}