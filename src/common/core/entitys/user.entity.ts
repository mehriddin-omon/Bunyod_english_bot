import { Column, Entity } from "typeorm";
import { BaseEntity } from "./base.entity";

@Entity({ name: 'users' })
export class User extends BaseEntity {

    @Column({ type: 'varchar', name: 'username' })
    username: string;

    @Column({ type: 'varchar', name: 'password' })
    password: string;

    @Column({ type: 'varchar', name: 'fullName', nullable: true })
    fullName: string;
    
    @Column({ type: 'bigint', name: 'telegramId', nullable: true })
    telegramId: number;

    @Column({ type: 'varchar', name: 'role', default: 'student' })
    role: 'admin' | 'student' | 'teacher' | 'superAdmin';

    @Column({ type: 'float', name: 'vocabulary_rating', default: 0 })
    vocabulary_rating: number;
}
