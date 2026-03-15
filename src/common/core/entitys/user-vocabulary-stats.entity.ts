import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { VocabularyRelations } from "./vocabulary.entity";


@Entity("uservocabularystats")
class UserVocabularyStats extends BaseEntity {

    @Column({ type: 'varchar', name: 'word' })
    user_id: string;

    @Column({ nullable: true, name: 'lang', default: 'en' })
    lang: string;

    @Column({ nullable: true })
    attempts: number;

    @Column({ nullable: true })
    wrong_attempts: number;

    @Column({ type: "bigint", default: 0 })
    last_attempts: number;

    @ManyToOne(() => User, (User) => User.id, { onDelete: "CASCADE" })
    userId: User[];

    @ManyToOne(() => VocabularyRelations, (relation) => relation.id)
    vocabulary_relation_id: VocabularyRelations[];
}


export { UserVocabularyStats };