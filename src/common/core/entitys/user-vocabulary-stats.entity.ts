import { Column, Entity, ManyToMany, ManyToOne, OneToMany } from "typeorm";
import { BaseEntity } from "./base.entity";
import { User } from "./user.entity";
import { VocabularyRelations } from "./vocabulary.entity";


// user-vocabulary-stats.entity.ts
@Entity("uservocabularystats")
class UserVocabularyStats extends BaseEntity {
    @Column({ nullable: true, name: 'lang', default: 'en' })
    lang: string;

    @Column({ nullable: true })
    attempts: number;

    @Column({ nullable: true })
    wrong_attempts: number;

    // @Column({name: 'user_id',})
    @ManyToOne(() => User, (user) => user.vocabulary_stats, { onDelete: "CASCADE" })
    user: User;

    @ManyToOne(() => VocabularyRelations, (relation) => relation.id)
    vocabulary_relation: VocabularyRelations;
}

export { UserVocabularyStats };