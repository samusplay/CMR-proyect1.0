export class LeadResponseDto {
  id!: string;
  name!: string;
  email !: string;
  phone !: string | null;
  campaignId!: string | null;
  createdAt !: Date;
}