export enum ResourceType {
  AUDIO = 'audio',
  PDF = 'pdf',
  DOCUMENT = 'document',
  VIDEO = 'video'
}

export enum LessonStatus {
  draft = 'draft',           // hali chala tayyorlangan 
  published = 'published',   // tayyor holatga keltirilgan 
  archived = 'archived',     // o'chirilgan 
}

export enum Role {
  superAdmin =  'superAdmin',   //  bu men asosiy admin
  admin = 'admin',              //  bu o'quv markazlar katta o'qituvchilari
  teacher = 'teacher',          //  bu o'quv markaz o'qituvchilari
  student = 'student'           //  bu o'quvchilar 
}