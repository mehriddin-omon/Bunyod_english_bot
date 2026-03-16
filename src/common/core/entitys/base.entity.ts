import {
    BeforeUpdate,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";

@Entity()
export abstract class BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({
        name: 'created_at',
        type: 'timestamptz'
    })
    created_at: Date;

    @UpdateDateColumn({
        name: 'update_at',
        type: 'timestamptz'
    })
    update_at: Date;

    // @BeforeUpdate()
    // updateTimestamp() {
    //     this.update_at = new Date();
    // }
}