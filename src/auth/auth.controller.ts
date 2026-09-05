import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller('auth')
export class AuthController {
    //inyectar el servicio
    constructor(private readonly authService: AuthService) { }


    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

}