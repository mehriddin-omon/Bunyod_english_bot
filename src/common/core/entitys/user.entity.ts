import { Column, Entity } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity({ name: 'users' })
export class User extends BaseEntity{
    
    @Column({ type: 'bigint', name: 'telegramId', nullable: true })
    telegramId: number;

    @Column({ type: 'varchar', name: 'username', nullable: true })
    username: string;

    @Column({ type: 'varchar', name: 'fullName', nullable: true })
    fullName: string;

    @Column({ type: 'varchar', name: 'password', nullable: true })
    password: string;

    @Column({ type: 'varchar', name: 'role', nullable: true })
    role: 'admin' | 'student' | 'teacher';
}
