import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";

@Module({
    imports: [TypeOrmModule.forFeature([])],
    providers: [AdminService],
    controllers: [AdminController],
    exports: [AdminService]
})
export class AdminModule { }
