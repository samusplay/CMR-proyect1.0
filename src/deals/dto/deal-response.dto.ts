import { DealStage, InstallationType } from '@prisma/client';

export class DealResponseDto {
  id!: string;
  stage!: DealStage;
  installationType!: InstallationType;
  estimatedValue!: number;
  expectedCloseDate!: Date | null;
  notes!: string | null;
  assignedToId!: string | null;
  leadId!: string;
  updatedAt!: Date;
}