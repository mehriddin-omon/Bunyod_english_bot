import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'bigint', name: 'telegramId', nullable: true })
    telegramId: number;

    @Column({ type: 'varchar', name: 'username', nullable: true })
    username: string;

    @Column({ type: 'varchar', name: 'fullName', nullable: true })
    fullName: string;

    @Column({ type: 'varchar', name: 'role', nullable: true })
    role: 'admin' | 'student';
}
