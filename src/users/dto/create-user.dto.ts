import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    name !: string;

    @IsEmail()
    email !: string;

    @IsString()
    @MinLength(6)
    password !: string;

    @IsIn(['admin', 'vendedor'])
    @IsOptional()
    role?: string;
}