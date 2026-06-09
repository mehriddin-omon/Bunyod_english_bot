import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from 'src/common/core/entitys/assignment.entity';
import { AssignmentSubmission } from 'src/common/core/entitys/assignment.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { CreateAssignmentDto, SubmitAssignmentDto, GradeSubmissionDto } from './dto/assignment.dto';
import { AssignmentStatus, SubmissionStatus, NotificationType, Role } from 'src/common/utils/enum';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,

    @InjectRepository(AssignmentSubmission)
    private readonly submissionRepo: Repository<AssignmentSubmission>,

    @InjectRepository(Group)
    private readonly groupRepo: Repository<Group>,

    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async getAssignments(userId: string, userRole: Role): Promise<any> {
    if (userRole === Role.student) {
      // Student: o'z topshiriqlari
      const groups = await this.groupRepo.find({
        where: { members: { id: userId } },
        relations: ['members'],
      });
      const groupIds = groups.map((g) => g.id);
      if (!groupIds.length) return { data: [] };

      const assignments = await this.assignmentRepo.find({
        where: { status: AssignmentStatus.active },
        relations: ['group'],
      });

      const data = await Promise.all(
        assignments
          .filter((a) => groupIds.includes(a.groupId))
          .map(async (a) => {
            const submission = await this.submissionRepo.findOne({
              where: { assignmentId: a.id, studentId: userId },
            });
            return {
              id: a.id,
              title: a.title,
              type: a.type,
              due_date: a.dueDate,
              group: { id: a.group?.id, name: a.group?.name },
              status: submission?.status ?? 'NOT_SUBMITTED',
            };
          }),
      );
      return { data };
    }

    // Teacher/Admin: o'z guruhlarining topshiriqlari
    const assignments = await this.assignmentRepo.find({
      where: { teacherId: userId },
      relations: ['group'],
    });
    const data = await Promise.all(
      assignments.map(async (a) => {
        const submitted = await this.submissionRepo.count({
          where: { assignmentId: a.id },
        });
        const group = await this.groupRepo.findOne({
          where: { id: a.groupId },
          relations: ['members'],
        });
        return {
          id: a.id,
          title: a.title,
          type: a.type,
          due_date: a.dueDate,
          group: { id: a.group?.id, name: a.group?.name },
          status: a.status,
          submitted_count: submitted,
          total_count: group?.members?.length ?? 0,
        };
      }),
    );
    return { data };
  }

  async createAssignment(teacherId: string, dto: CreateAssignmentDto): Promise<Assignment> {
    const group = await this.groupRepo.findOne({
      where: { id: dto.groupId },
      relations: ['members'],
    });
    if (!group) throw new NotFoundException('Guruh topilmadi');

    const assignment = this.assignmentRepo.create({
      teacherId,
      groupId: dto.groupId,
      lessonId: dto.lessonId,
      title: dto.title,
      description: dto.description,
      type: dto.type,
      dueDate: new Date(dto.dueDate),
      status: AssignmentStatus.active,
    });
    const saved = await this.assignmentRepo.save(assignment);

    // Guruh a'zolariga bildirishnoma
    for (const member of group.members) {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: member.id,
          type: NotificationType.assignment,
          title: 'Yangi topshiriq',
          body: dto.title,
          referenceId: saved.id,
          referenceType: 'assignment',
        }),
      );
    }

    return saved;
  }

  async submitAssignment(assignmentId: string, studentId: string, dto: SubmitAssignmentDto) {
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi');

    const existing = await this.submissionRepo.findOne({
      where: { assignmentId, studentId },
    });
    if (existing && existing.status === SubmissionStatus.graded) {
      throw new ForbiddenException('Bu topshiriq allaqachon baholangan');
    }

    const now = new Date();
    const isLate = assignment.dueDate && now > assignment.dueDate;

    const submission = existing ?? this.submissionRepo.create({ assignmentId, studentId });
    submission.textContent = dto.content ?? null;
    submission.fileId = dto.fileUrl ?? null;
    submission.status = isLate ? SubmissionStatus.late : SubmissionStatus.submitted;
    submission.submittedAt = now;

    await this.submissionRepo.save(submission);
    return { submission_id: submission.id, status: submission.status };
  }

  async getSubmissions(assignmentId: string, teacherId: string): Promise<any> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, teacherId },
    });
    if (!assignment) throw new NotFoundException('Topshiriq topilmadi yoki ruxsat yo\'q');

    const submissions = await this.submissionRepo.find({
      where: { assignmentId },
      relations: ['student'],
    });

    const stats = {
      submitted: submissions.filter((s) => s.status === SubmissionStatus.submitted).length,
      pending: submissions.filter((s) => s.status === SubmissionStatus.pending).length,
      late: submissions.filter((s) => s.status === SubmissionStatus.late).length,
      graded: submissions.filter((s) => s.status === SubmissionStatus.graded).length,
      total: submissions.length,
    };

    return {
      assignment: { id: assignment.id, title: assignment.title, type: assignment.type },
      submissions: submissions.map((s) => ({
        id: s.id,
        student: {
          id: s.student?.id,
          first_name: s.student?.firstName ?? '',
          last_name: s.student?.lastName ?? '',
        },
        status: s.status,
        submitted_at: s.submittedAt,
        score: s.score,
        feedback: s.feedback,
      })),
      stats,
    };
  }

  async gradeSubmission(
    assignmentId: string,
    submissionId: string,
    teacherId: string,
    dto: GradeSubmissionDto,
  ) {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, teacherId },
    });
    if (!assignment) throw new ForbiddenException('Ruxsat yo\'q');

    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId, assignmentId },
    });
    if (!submission) throw new NotFoundException('Topshiriq topilmadi');

    submission.score = dto.score;
    submission.feedback = dto.feedback ?? null;
    submission.status = SubmissionStatus.graded;
    submission.gradedAt = new Date();
    submission.gradedBy = teacherId;

    await this.submissionRepo.save(submission);

    // Bildirishnoma
    await this.notificationRepo.save(
      this.notificationRepo.create({
        userId: submission.studentId,
        type: NotificationType.assignment,
        title: "Topshirig'ingiz baholandi",
        body: `${assignment.title}: ${dto.score}/100`,
        referenceId: assignmentId,
        referenceType: 'assignment',
      }),
    );

    return { ...submission, xp_earned: Math.round(dto.score / 100 * 40) };
  }
}
