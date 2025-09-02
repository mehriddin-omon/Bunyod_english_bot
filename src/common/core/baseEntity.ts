import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        name: 'created_at',
        type: 'date',
        default: new Date(Date.now())
    })
    created_at: Date;

    @Column({
        name: 'update_at',
        type: 'date',
        default: new Date(Date.now())
    })
    update_at: Date;
}