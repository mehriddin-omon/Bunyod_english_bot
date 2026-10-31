import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { CreateUnitDto, UpdateUnitDto } from './dto/unit.dto';

export interface TeacherUnitRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
  lessonCount: number;
  publishedCount: number;
  draftCount: number;
}

/**
 * Bo'limlar (units) CRUD. `units.number` UNIQUE — raqam almashtirish / tartiblash shunga moslab yozilgan.
 * Bo'lim o'chirilganda darslari yo'qolmaydi: boshqa bo'limga ko'chiriladi yoki bo'limsiz qoladi.
 */
@Injectable()
export class TeacherUnitsService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Unit) private readonly unitRepo: Repository<Unit>,
  ) {}

  /** Hamma bo'limlar + darslar soni (bitta GROUP BY) */
  async list(): Promise<TeacherUnitRow[]> {
    const rows = await this.ds.query(
      `SELECT u.id, u.number, u.title, u.description,
              COUNT(l.id)::int AS lesson_count,
              COUNT(l.id) FILTER (WHERE l.status = 'published')::int AS published_count,
              COUNT(l.id) FILTER (WHERE l.status = 'draft')::int AS draft_count
         FROM units u
         LEFT JOIN lessons l ON l.unit_id = u.id
        GROUP BY u.id
        ORDER BY u.number ASC`,
    );
    return rows.map((r: any) => ({
      id: r.id,
      number: Number(r.number),
      title: r.title,
      description: r.description ?? null,
      lessonCount: Number(r.lesson_count),
      publishedCount: Number(r.published_count),
      draftCount: Number(r.draft_count),
    }));
  }

  private async getRow(id: string): Promise<TeacherUnitRow> {
    const row = (await this.list()).find((u) => u.id === id);
    if (!row) throw new NotFoundException("Bo'lim topilmadi");
    return row;
  }

  private async assertNumberFree(number: number, exceptId?: string) {
    const [taken] = await this.ds.query(
      `SELECT id FROM units WHERE number = $1 ${exceptId ? 'AND id <> $2' : ''} LIMIT 1`,
      exceptId ? [number, exceptId] : [number],
    );
    if (taken) {
      throw new ConflictException(
        `${number}-bo'lim allaqachon bor. Tartibni o'zgartirish uchun bo'limlarni yuqoriga/pastga suring.`,
      );
    }
  }

  async create(dto: CreateUnitDto): Promise<TeacherUnitRow> {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException("Bo'lim nomini kiriting");
    let number = dto.number;
    if (number != null) await this.assertNumberFree(number);
    else {
      const [{ next }] = await this.ds.query(`SELECT COALESCE(MAX(number), 0) + 1 AS next FROM units`);
      number = Number(next);
    }
    const saved = await this.unitRepo.save(
      this.unitRepo.create({ number, title, description: dto.description?.trim() || null }),
    );
    return this.getRow(saved.id);
  }

  async update(id: string, dto: UpdateUnitDto): Promise<TeacherUnitRow> {
    const current = await this.getRow(id);
    const title = dto.title !== undefined ? dto.title.trim() : current.title;
    if (!title) throw new BadRequestException("Bo'lim nomini kiriting");
    const description =
      dto.description !== undefined ? dto.description?.trim() || null : current.description;
    const number = dto.number ?? current.number;
    if (number !== current.number) await this.assertNumberFree(number, id);
    await this.ds.query(
      `UPDATE units SET title = $2, description = $3, number = $4, updated_at = now() WHERE id = $1`,
      [id, title, description, number],
    );
    return this.getRow(id);
  }

  /** Yangi tartib: `ids` dagi o'rniga qarab 1, 2, 3 … (ro'yxatda HAMMA bo'lim bo'lishi shart) */
  async reorder(ids: string[]): Promise<TeacherUnitRow[]> {
    const all: { id: string }[] = await this.ds.query(`SELECT id FROM units`);
    const unique = new Set(ids);
    if (unique.size !== ids.length || unique.size !== all.length || all.some((u) => !unique.has(u.id))) {
      throw new BadRequestException("Tartib ro'yxatida hamma bo'lim bir martadan bo'lishi kerak");
    }
    await this.ds.transaction(async (m) => {
      // UNIQUE(number) to'qnashmasligi uchun avval hammasi manfiyga, keyin 1..n
      await m.query(`UPDATE units SET number = -number - 1`);
      await m.query(
        `UPDATE units u SET number = v.n, updated_at = now()
           FROM unnest($1::uuid[]) WITH ORDINALITY AS v(id, n)
          WHERE u.id = v.id`,
        [ids],
      );
    });
    return this.list();
  }

  async remove(id: string, opts: { moveTo?: string; detach?: boolean }) {
    const unit = await this.getRow(id);
    if (unit.lessonCount > 0) {
      if (opts.moveTo) {
        if (opts.moveTo === id) throw new BadRequestException("Darslarni boshqa bo'limga ko'chiring");
        const [target] = await this.ds.query(`SELECT id FROM units WHERE id = $1`, [opts.moveTo]);
        if (!target) throw new NotFoundException("Ko'chiriladigan bo'lim topilmadi");
      } else if (!opts.detach) {
        throw new BadRequestException({
          message: `Bo'limda ${unit.lessonCount} ta dars bor — ularni boshqa bo'limga ko'chiring yoki bo'limsiz qoldiring`,
          code: 'UNIT_HAS_LESSONS',
        });
      }
    }
    await this.ds.transaction(async (m) => {
      if (unit.lessonCount > 0 && opts.moveTo) {
        // Ko'chirilgan darslar maqsad bo'limdagi darslardan KEYIN turadi (tartib raqami suriladi)
        await m.query(
          `UPDATE lessons
              SET unit_id = $2,
                  order_index = order_index + (SELECT COALESCE(MAX(order_index), 0) FROM lessons WHERE unit_id = $2)
            WHERE unit_id = $1`,
          [id, opts.moveTo],
        );
      } else if (unit.lessonCount > 0) {
        await m.query(`UPDATE lessons SET unit_id = NULL WHERE unit_id = $1`, [id]);
      }
      await m.query(`DELETE FROM units WHERE id = $1`, [id]);
    });
    return { message: "Bo'lim o'chirildi", movedLessons: unit.lessonCount };
  }
}
