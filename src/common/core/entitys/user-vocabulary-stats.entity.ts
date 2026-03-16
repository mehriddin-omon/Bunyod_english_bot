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

    @Column({ type: "bigint", default: 0 })
    last_attempts: number;

    @ManyToOne(() => User, (user) => user.vocabularyStats, { onDelete: "CASCADE" })
    user: User;

    @ManyToOne(() => VocabularyRelations, (relation) => relation.id)
    vocabularyRelation: VocabularyRelations;
}

export { UserVocabularyStats };