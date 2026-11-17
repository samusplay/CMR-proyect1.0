import { IsNotEmpty, IsString } from 'class-validator';

export class GenerateOfferDto {
  @IsString({ message: 'El id del deal debe ser un texto' })
  @IsNotEmpty({ message: 'El id del deal es obligatorio' })
  dealId!: string;
}