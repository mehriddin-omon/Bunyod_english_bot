import { CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamp'
    })
    created_at: Date;

    @UpdateDateColumn({
        name: 'update_at',
        type: 'timestamp'
    })
    update_at: Date;
}