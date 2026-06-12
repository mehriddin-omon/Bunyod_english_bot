import * as dotenv from 'dotenv';
dotenv.config();

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// ── Entities ──────────────────────────────────────────────────────────────────
import { User } from 'src/common/core/entitys/user.entity';
import { StudentProfile } from 'src/common/core/entitys/student-profile.entity';
import { TeacherProfile } from 'src/common/core/entitys/teacher-profile.entity';
import { UserGamification, XpTransaction, UserSkill } from 'src/common/core/entitys/gamification.entity';
import { Achievement } from 'src/common/core/entitys/achievement.entity';
import { Unit } from 'src/common/core/entitys/unit.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { Group } from 'src/common/core/entitys/group.entity';
import { Schedule } from 'src/common/core/entitys/schedule.entity';
import { Vocabulary } from 'src/common/core/entitys/vocabulary.entity';
import { VocabularyExample } from 'src/common/core/entitys/vocabulary-example.entity';
import { UserVocabularyProgress } from 'src/common/core/entitys/user-vocabulary-progress.entity';
import { LessonProgress } from 'src/common/core/entitys/lesson-progress.entity';
import { Notification } from 'src/common/core/entitys/notification.entity';
import { DailyTracking } from 'src/common/core/entitys/daily-tracking.entity';
import { GrammarContent } from 'src/common/core/entitys/grammar-content.entity';
import { ReadingContent } from 'src/common/core/entitys/reading-content.entity';
import { ReadingQuestion } from 'src/common/core/entitys/reading-question.entity';
import { ReadingOption } from 'src/common/core/entitys/reading-option.entity';
import { ListeningContent } from 'src/common/core/entitys/listening-content.entity';
import { ListeningTranscript } from 'src/common/core/entitys/listening-transcript.entity';
import { ListeningQuestion } from 'src/common/core/entitys/listening-question.entity';
import { ListeningOption } from 'src/common/core/entitys/listening-option.entity';
import { Assignment } from 'src/common/core/entitys/assignment.entity';

// ── Enums ─────────────────────────────────────────────────────────────────────
import {
  Role,
  LessonType,
  LessonStatus,
  AchievementCondition,
  League,
  CefrLevel,
  PartOfSpeech,
} from 'src/common/utils/enum';

// ── DataSource ────────────────────────────────────────────────────────────────
const ds = new DataSource({
  type: 'postgres',
  url: process.env.DB_URL,
  entities: [
    User, StudentProfile, TeacherProfile,
    UserGamification, XpTransaction, UserSkill,
    Achievement,
    Unit, Lesson, LessonProgress,
    Group, Schedule,
    Vocabulary, VocabularyExample, UserVocabularyProgress,
    Notification, DailyTracking,
    GrammarContent,
    ReadingContent, ReadingQuestion, ReadingOption,
    ListeningContent, ListeningTranscript, ListeningQuestion, ListeningOption,
    Assignment,
  ],
  synchronize: false,
});

// ── Content helpers ───────────────────────────────────────────────────────────

function grammarContent(heading: string, desc: string, formulaParts: string[], example: { en: string; uz: string; keyword: string }, rules: { title: string; body: string }[]) {
  return {
    badge: 'Grammar',
    heading,
    description: desc,
    formula: formulaParts.map((text, i) =>
      i % 2 === 1 ? { text, sep: true } : { text },
    ),
    examples: [{ en: example.en, uz: example.uz, keyword: example.keyword }],
    rules,
    relatedWords: rules.map((r) => r.title),
    tip: `${heading} — ingliz tilida muhim grammatik mavzu.`,
  };
}

function readingContent(title: string, author: string, paragraphs: string[], questions: { q: string; options: string[]; correct: string }[]) {
  return {
    text: {
      title,
      author,
      wordCount: paragraphs.join(' ').split(/\s+/).length,
      readTime: 5,
      paragraphs: paragraphs.map((text) => ({ text, highlights: [] })),
    },
    questions: questions.map((q, i) => ({
      id: `q${i + 1}`,
      type: 'multiple_choice',
      question: q.q,
      options: q.options,
      correct: q.correct,
    })),
  };
}

function listeningContent(title: string, speakers: { id: string; name: string }[], transcript: { speaker: string; timeStart: number; text: string }[], questions: { q: string; options: string[]; correct: string }[]) {
  return {
    audio: {
      title,
      trackCode: `demo.${Math.floor(Math.random() * 20) + 1}`,
      duration: 180,
      audioUrl: '/uploads/demo-track.mp3',
      speakers,
    },
    transcript,
    questions: questions.map((q, i) => ({
      id: `q${i + 1}`,
      type: 'multiple_choice',
      question: q.q,
      options: q.options,
      correct: q.correct,
    })),
  };
}

function vocabularyContent(words: { word: string; translation: string; example: string }[]) {
  return { words };
}

function testContent(questions: { q: string; options: string[]; correct: string }[]) {
  return {
    questions: questions.map((q, i) => ({
      id: `tq${i + 1}`,
      type: 'multiple_choice',
      question: q.q,
      options: q.options,
      correct: q.correct,
    })),
  };
}

// ── Per-unit lesson definitions ───────────────────────────────────────────────

type LessonDef = { name: string; [key: string]: any };

function buildUnit1Lessons(): LessonDef[] {
  return [
    {
      name: 'Present Simple — asoslar',
      type: LessonType.grammar,
      duration: 15,
      content: grammarContent(
        'Present Simple',
        'Hozirgi zamon oddiy — odatiy harakatlar uchun ishlatiladi.',
        ['Subject', '+', 'Verb (base)', '+', 'Object'],
        { en: 'I go to school every day.', uz: 'Men har kuni maktabga boraman.', keyword: 'go' },
        [{ title: 'He/She/It uchun', body: "Verb + s/es qo'shiladi: works, watches" }],
      ),
    },
    {
      name: 'To Be — bo\'lmoq fe\'li',
      type: LessonType.grammar,
      duration: 15,
      content: grammarContent(
        'To Be',
        "Am/Is/Are — mavjudlik va ta'rifni ifodalaydi.",
        ['Subject', '+', 'am/is/are', '+', 'Complement'],
        { en: 'She is a student.', uz: 'U talaba.', keyword: 'is' },
        [{ title: 'Inkor shakli', body: "am not / is not / are not — qisqartiriladi: isn't, aren't" }],
      ),
    },
    {
      name: 'Articles — a, an, the',
      type: LessonType.grammar,
      duration: 15,
      content: grammarContent(
        'Articles',
        "A, an, the — artiklar nomlar oldidan ishlatiladi.",
        ['a/an/the', '+', 'Noun'],
        { en: 'I saw a dog and the dog was big.', uz: 'Men it ko\'rdim va u it katta edi.', keyword: 'a/the' },
        [
          { title: 'A vs An', body: 'Unli tovush bilan boshlanuvchi so\'z oldidan an: an apple, an hour' },
          { title: 'The', body: "Ma'lum narsa yoki yagona narsalar oldidan: the sun, the president" },
        ],
      ),
    },
    {
      name: 'Pronouns — olmoshlar',
      type: LessonType.grammar,
      duration: 15,
      content: grammarContent(
        'Personal Pronouns',
        "Shaxs olmoshlari — I, you, he, she, it, we, they.",
        ['Subject pronoun', '+', 'Verb'],
        { en: 'They are my friends.', uz: 'Ular mening do\'stlarim.', keyword: 'they' },
        [{ title: 'Object olmoshlari', body: 'me, you, him, her, it, us, them — gapda to\'ldiruvchi vazifasida' }],
      ),
    },
    {
      name: 'My First Day at School',
      type: LessonType.reading,
      duration: 20,
      content: readingContent(
        'My First Day at School',
        'Emma Brown',
        [
          'I woke up early on my first day at school. My mother made breakfast for me.',
          'I put on my new uniform and looked in the mirror. I felt nervous but excited.',
          'At school, my teacher was very kind. She showed me to my seat next to a friendly boy named Tom.',
          'We had lessons in maths, English, and art. I enjoyed drawing the most.',
          'After school, my mother was waiting for me. I told her everything about my amazing day.',
        ],
        [
          { q: 'How did the writer feel on the first day?', options: ['Sad', 'Nervous but excited', 'Angry', 'Bored'], correct: 'Nervous but excited' },
          { q: 'What subject did the writer enjoy most?', options: ['Maths', 'English', 'Art', 'Science'], correct: 'Art' },
          { q: "Who was waiting after school?", options: ['Father', 'Teacher', 'Mother', 'Tom'], correct: 'Mother' },
        ],
      ),
    },
    {
      name: 'Hello, My Name Is...',
      type: LessonType.reading,
      duration: 20,
      content: readingContent(
        'Hello, My Name Is Anna',
        'Sarah White',
        [
          'My name is Anna. I am twelve years old and I live in London.',
          "I have a small family. My mother's name is Maria and my father's name is John.",
          'I go to school every day. My favourite subject is English because I love reading books.',
          'After school I play with my friend Lisa. We ride bikes in the park near our house.',
          'On weekends, my family visits my grandparents. They live in a small village.',
        ],
        [
          { q: 'How old is Anna?', options: ['10', '11', '12', '13'], correct: '12' },
          { q: 'What is her favourite subject?', options: ['Maths', 'Science', 'English', 'Art'], correct: 'English' },
          { q: 'Where do grandparents live?', options: ['London', 'A village', 'Paris', 'A city'], correct: 'A village' },
        ],
      ),
    },
    {
      name: 'Numbers and Colors',
      type: LessonType.reading,
      duration: 20,
      content: readingContent(
        'Numbers and Colors',
        'John Davis',
        [
          'Numbers and colors are very important in everyday life.',
          "The sky is blue and the grass is green. I have two sisters and one brother.",
          'At the market there are red apples, yellow bananas, and orange oranges.',
          'My house has five rooms. The walls are white and the doors are brown.',
          'I like the number seven because it is my lucky number.',
        ],
        [
          { q: 'What color is the sky?', options: ['Green', 'Blue', 'Red', 'Yellow'], correct: 'Blue' },
          { q: 'How many rooms does the house have?', options: ['3', '4', '5', '6'], correct: '5' },
          { q: 'What is his lucky number?', options: ['3', '5', '6', '7'], correct: '7' },
        ],
      ),
    },
    {
      name: 'A Day in the Life',
      type: LessonType.listening,
      duration: 25,
      content: listeningContent(
        'A Day in the Life',
        [{ id: 'A', name: 'Emma' }, { id: 'B', name: 'Tom' }],
        [
          { speaker: 'A', timeStart: 5, text: "Hi Tom! What time do you usually wake up?" },
          { speaker: 'B', timeStart: 12, text: "I wake up at seven o'clock every morning." },
          { speaker: 'A', timeStart: 20, text: 'Do you have breakfast before school?' },
          { speaker: 'B', timeStart: 28, text: 'Yes, I always eat toast and drink orange juice.' },
          { speaker: 'A', timeStart: 38, text: 'That sounds healthy! What do you do after school?' },
          { speaker: 'B', timeStart: 46, text: 'I do my homework first, then I watch TV or play football.' },
        ],
        [
          { q: 'What time does Tom wake up?', options: ['6:00', '7:00', '8:00', '9:00'], correct: '7:00' },
          { q: 'What does Tom eat for breakfast?', options: ['Eggs', 'Toast', 'Cereal', 'Pancakes'], correct: 'Toast' },
          { q: 'What does Tom do first after school?', options: ['Watch TV', 'Play football', 'Homework', 'Read'], correct: 'Homework' },
        ],
      ),
    },
    {
      name: 'At the Park',
      type: LessonType.listening,
      duration: 25,
      content: listeningContent(
        'At the Park',
        [{ id: 'A', name: 'Lisa' }, { id: 'B', name: 'Jack' }],
        [
          { speaker: 'A', timeStart: 3, text: 'Look at all the children playing in the park!' },
          { speaker: 'B', timeStart: 9, text: 'Yes, it is a beautiful day. The sun is shining.' },
          { speaker: 'A', timeStart: 16, text: 'I can see a dog running near the lake. It is brown.' },
          { speaker: 'B', timeStart: 25, text: 'And there is a family having a picnic under the big tree.' },
          { speaker: 'A', timeStart: 34, text: 'I love coming to the park on Saturdays.' },
        ],
        [
          { q: 'What color is the dog?', options: ['Black', 'White', 'Brown', 'Grey'], correct: 'Brown' },
          { q: 'What is the family doing?', options: ['Playing', 'Swimming', 'Having a picnic', 'Running'], correct: 'Having a picnic' },
          { q: 'When does she like coming to the park?', options: ['Sundays', 'Fridays', 'Saturdays', 'Mondays'], correct: 'Saturdays' },
        ],
      ),
    },
    {
      name: 'Family Members',
      type: LessonType.listening,
      duration: 25,
      content: listeningContent(
        'Talking About Family',
        [{ id: 'A', name: 'Maria' }, { id: 'B', name: 'Ahmed' }],
        [
          { speaker: 'A', timeStart: 4, text: 'Ahmed, tell me about your family.' },
          { speaker: 'B', timeStart: 10, text: 'Sure! I have a big family — two brothers, one sister, my parents and grandparents.' },
          { speaker: 'A', timeStart: 22, text: 'That is a big family! Do you all live together?' },
          { speaker: 'B', timeStart: 28, text: 'Yes, we live in the same house. It is busy but fun!' },
          { speaker: 'A', timeStart: 38, text: 'I am an only child. I always wanted a sibling.' },
        ],
        [
          { q: 'How many siblings does Ahmed have?', options: ['2', '3', '4', '5'], correct: '3' },
          { q: 'Do they all live together?', options: ['Yes', 'No', 'Sometimes', 'Unknown'], correct: 'Yes' },
          { q: 'How many children does Maria have?', options: ['1', '2', '0', '3'], correct: '1' },
        ],
      ),
    },
    {
      name: 'Basic Greetings',
      type: LessonType.vocabulary,
      duration: 20,
      content: vocabularyContent([
        { word: 'hello', translation: 'salom', example: 'Hello! How are you?' },
        { word: 'goodbye', translation: 'xayr', example: 'Goodbye! See you tomorrow.' },
        { word: 'please', translation: 'iltimos', example: 'Can you help me, please?' },
        { word: 'thank you', translation: 'rahmat', example: 'Thank you for your help.' },
        { word: 'sorry', translation: 'kechirasiz', example: 'Sorry, I am late.' },
      ]),
    },
    {
      name: 'Family Words',
      type: LessonType.vocabulary,
      duration: 20,
      content: vocabularyContent([
        { word: 'mother', translation: 'ona', example: 'My mother is a doctor.' },
        { word: 'father', translation: 'ota', example: 'My father works in an office.' },
        { word: 'brother', translation: 'aka/uka', example: 'I have two brothers.' },
        { word: 'sister', translation: 'opa/singil', example: 'My sister is five years old.' },
        { word: 'grandparent', translation: 'buvayi/momi', example: 'I visit my grandparents on weekends.' },
      ]),
    },
    {
      name: 'Colors and Numbers',
      type: LessonType.vocabulary,
      duration: 20,
      content: vocabularyContent([
        { word: 'red', translation: 'qizil', example: 'The apple is red.' },
        { word: 'blue', translation: 'ko\'k', example: 'The sky is blue.' },
        { word: 'green', translation: 'yashil', example: 'The grass is green.' },
        { word: 'twenty', translation: 'yigirma', example: 'There are twenty students in the class.' },
        { word: 'hundred', translation: 'yuz', example: 'I have one hundred coins.' },
      ]),
    },
    {
      name: 'School Subjects',
      type: LessonType.vocabulary,
      duration: 20,
      content: vocabularyContent([
        { word: 'science', translation: 'tabiiy fanlar', example: 'Science class is interesting.' },
        { word: 'history', translation: 'tarix', example: 'We study history on Wednesdays.' },
        { word: 'geography', translation: 'geografiya', example: 'I enjoy geography lessons.' },
        { word: 'music', translation: 'musiqa', example: 'We sing songs in music class.' },
        { word: 'physical education', translation: 'jismoniy tarbiya', example: 'PE class is my favourite.' },
      ]),
    },
    {
      name: 'Action Words',
      type: LessonType.vocabulary,
      duration: 20,
      content: vocabularyContent([
        { word: 'run', translation: 'yugurmoq', example: 'I run in the park every morning.' },
        { word: 'eat', translation: 'yemoq', example: 'We eat dinner at seven.' },
        { word: 'sleep', translation: 'uxlamoq', example: 'Children should sleep early.' },
        { word: 'study', translation: 'o\'qimoq', example: 'I study English every day.' },
        { word: 'play', translation: 'o\'ynamoq', example: 'They play football after school.' },
      ]),
    },
    {
      name: 'Unit 1 — Test 1',
      type: LessonType.test,
      duration: 30,
      content: testContent([
        { q: 'She ___ a student.', options: ['am', 'is', 'are', 'be'], correct: 'is' },
        { q: 'I ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], correct: 'go' },
        { q: 'Choose the correct article: ___ elephant.', options: ['a', 'an', 'the', 'no article'], correct: 'an' },
        { q: 'They ___ my friends.', options: ['am', 'is', 'are', 'be'], correct: 'are' },
        { q: 'Choose the correct pronoun: ___ is my book.', options: ['Him', 'This', 'They', 'We'], correct: 'This' },
      ]),
    },
    {
      name: 'Unit 1 — Test 2',
      type: LessonType.test,
      duration: 30,
      content: testContent([
        { q: 'He ___ football on weekends.', options: ['play', 'plays', 'playing', 'played'], correct: 'plays' },
        { q: 'What color is the sky?', options: ['Red', 'Green', 'Blue', 'Yellow'], correct: 'Blue' },
        { q: 'My ___ is a teacher. (father)', options: ['father', 'mother', 'sister', 'brother'], correct: 'father' },
        { q: 'I ___ happy today.', options: ['am', 'is', 'are', 'be'], correct: 'am' },
        { q: 'We use "an" before words starting with a ___', options: ['consonant', 'vowel sound', 'silent letter', 'capital letter'], correct: 'vowel sound' },
      ]),
    },
    {
      name: 'Present Continuous — hozirgi davom',
      type: LessonType.grammar,
      duration: 15,
      content: grammarContent(
        'Present Continuous',
        "Hozir sodir bo'layotgan harakatlar uchun ishlatiladi.",
        ['Subject', '+', 'am/is/are', '+', 'Verb-ing'],
        { en: 'She is reading a book now.', uz: 'U hozir kitob o\'qiyapti.', keyword: 'reading' },
        [{ title: 'Imlo qoidasi', body: 'run→running, write→writing, stop→stopping' }],
      ),
    },
    {
      name: 'Weekend Routines',
      type: LessonType.reading,
      duration: 20,
      content: readingContent(
        'Weekend Routines',
        'Paul Green',
        [
          'Every Saturday morning I wake up at nine. I make coffee and sit by the window.',
          'After breakfast, I go to the market. I buy fresh vegetables and fruit.',
          'In the afternoon I meet my friends. We often go to the cinema or play basketball.',
          'On Sunday I stay home. I clean the house and cook a big lunch for the family.',
          'Sunday evenings are my favourite — I watch a film and relax.',
        ],
        [
          { q: 'What time does he wake up on Saturday?', options: ['7:00', '8:00', '9:00', '10:00'], correct: '9:00' },
          { q: 'What does he do on Sunday morning?', options: ['Go to market', 'Play basketball', 'Clean the house', 'Watch a film'], correct: 'Clean the house' },
          { q: 'What is his favourite time?', options: ['Saturday morning', 'Saturday afternoon', 'Sunday afternoon', 'Sunday evening'], correct: 'Sunday evening' },
        ],
      ),
    },
    {
      name: 'Morning Conversations',
      type: LessonType.listening,
      duration: 25,
      content: listeningContent(
        'Morning Conversations',
        [{ id: 'A', name: 'Nick' }, { id: 'B', name: 'Sara' }],
        [
          { speaker: 'A', timeStart: 3, text: 'Good morning, Sara! Did you sleep well?' },
          { speaker: 'B', timeStart: 9, text: 'Good morning! Yes, I slept very well, thank you.' },
          { speaker: 'A', timeStart: 16, text: "What are you doing today? It's Saturday!" },
          { speaker: 'B', timeStart: 23, text: 'I am going to the library in the morning and then the gym in the evening.' },
          { speaker: 'A', timeStart: 33, text: 'The gym? That sounds great. I want to come too!' },
        ],
        [
          { q: 'How did Sara sleep?', options: ['Badly', 'Not at all', 'Very well', 'A little'], correct: 'Very well' },
          { q: 'Where is Sara going in the morning?', options: ['Gym', 'Market', 'Library', 'Park'], correct: 'Library' },
          { q: 'What does Nick want to do?', options: ['Go to library', 'Come to the gym', 'Stay home', 'Go shopping'], correct: 'Come to the gym' },
        ],
      ),
    },
  ];
}

function buildUnit2Lessons(): LessonDef[] {
  return [
    { name: 'Past Simple — o\'tgan zamon', type: LessonType.grammar, duration: 15, content: grammarContent('Past Simple', "O'tgan zamonda yakunlangan harakatlar uchun.", ['Subject', '+', 'Verb (past)', '+', 'Object'], { en: 'I watched a film yesterday.', uz: 'Men kecha film ko\'rdim.', keyword: 'watched' }, [{ title: 'Irregular verbs', body: 'go→went, eat→ate, see→saw, have→had' }]) },
    { name: 'Past Continuous', type: LessonType.grammar, duration: 15, content: grammarContent('Past Continuous', "O'tgan zamonda davom etgan harakatlar.", ['Subject', '+', 'was/were', '+', 'Verb-ing'], { en: 'She was cooking when I arrived.', uz: 'Men kelganda u osh pishirayotgan edi.', keyword: 'was cooking' }, [{ title: 'Parallel actions', body: 'while + Past Cont., Past Simple — bir vaqtda ikki harakat' }]) },
    { name: 'Countable and Uncountable Nouns', type: LessonType.grammar, duration: 15, content: grammarContent('Countable/Uncountable', "Sanaladigan va sanalmaydigan otlar.", ['some/any/much/many', '+', 'Noun'], { en: 'I need some water and two apples.', uz: 'Menga bir oz suv va ikkita olma kerak.', keyword: 'some' }, [{ title: 'Much vs Many', body: 'much — sanalmaydigan: much water; many — sanaladigan: many books' }]) },
    { name: 'Comparative Adjectives', type: LessonType.grammar, duration: 15, content: grammarContent('Comparatives', "Sifatlarning qiyoslash darajasi.", ['Adj', '+', '-er / more', '+', 'than'], { en: 'This book is more interesting than that one.', uz: 'Bu kitob ancha qiziqarli.', keyword: 'more interesting' }, [{ title: 'Short adjectives', body: 'big→bigger, fast→faster, happy→happier' }]) },
    { name: 'A Busy Weekend', type: LessonType.reading, duration: 20, content: readingContent('A Busy Weekend', 'Linda Carter', ['Last weekend was very busy for my family.', 'On Saturday morning we drove to the countryside. The weather was perfect.', 'We had a picnic near a river. My children played in the water while I read a book.', 'In the evening we visited my aunt. She cooked a delicious dinner for us.', 'On Sunday we stayed home and rested. I needed to prepare for the new work week.'], [{ q: 'Where did they go on Saturday?', options: ['The beach', 'The countryside', 'The city', 'The mountains'], correct: 'The countryside' }, { q: 'What were the children doing at the river?', options: ['Fishing', 'Swimming', 'Playing in the water', 'Reading'], correct: 'Playing in the water' }, { q: 'Why did she stay home on Sunday?', options: ['She was sick', 'She was tired', 'Prepare for work', 'It rained'], correct: 'Prepare for work' }]) },
    { name: 'Food Around the World', type: LessonType.reading, duration: 20, content: readingContent('Food Around the World', 'James Wilson', ['People all over the world eat different foods, but some dishes are enjoyed everywhere.', 'In Italy, pizza and pasta are national favourites. In Japan, people love sushi and ramen.', 'In Uzbekistan, plov is the most famous dish. It is made with rice, meat, carrots, and onions.', 'In Mexico, tacos and burritos are popular street food. People eat them with salsa and guacamole.', 'Trying new foods is one of the best parts of traveling to a new country.'], [{ q: 'What is the national dish in Uzbekistan?', options: ['Sushi', 'Pizza', 'Plov', 'Tacos'], correct: 'Plov' }, { q: 'What do people put in tacos?', options: ['Sushi', 'Salsa and guacamole', 'Cheese', 'Rice'], correct: 'Salsa and guacamole' }, { q: 'Why is trying new food good?', options: ['It is cheap', 'Part of travelling', 'It is healthy', 'It is easy'], correct: 'Part of travelling' }]) },
    { name: 'The Lost Keys', type: LessonType.reading, duration: 20, content: readingContent('The Lost Keys', 'Hannah Moore', ['Yesterday morning, I could not find my keys. I searched everywhere in the house.', 'I looked in my bag, on the table, and under the sofa. Nothing.', 'I called my sister because she visited me the day before. She had not seen them.', 'Finally, I found them inside my coat pocket. I had forgotten I put them there.', 'I was late for work, but I laughed at myself. It happens to everyone!'], [{ q: 'What was the person looking for?', options: ['Phone', 'Wallet', 'Keys', 'Bag'], correct: 'Keys' }, { q: 'Who did she call?', options: ['Mother', 'Friend', 'Sister', 'Colleague'], correct: 'Sister' }, { q: 'Where were the keys?', options: ['In the bag', 'Under sofa', 'On the table', 'In the coat pocket'], correct: 'In the coat pocket' }]) },
    { name: 'Shopping Conversation', type: LessonType.listening, duration: 25, content: listeningContent('At the Supermarket', [{ id: 'A', name: 'Customer' }, { id: 'B', name: 'Shop assistant' }], [{ speaker: 'A', timeStart: 4, text: 'Excuse me, where can I find the milk?' }, { speaker: 'B', timeStart: 9, text: 'The milk is in aisle four, next to the yogurt.' }, { speaker: 'A', timeStart: 16, text: 'Thank you! And do you have any fresh bread?' }, { speaker: 'B', timeStart: 22, text: 'Yes, the bakery section is at the back of the store. It closes at 6 pm.' }, { speaker: 'A', timeStart: 32, text: 'Great! How much is this orange juice?' }, { speaker: 'B', timeStart: 38, text: 'That one is two pounds fifty.' }], [{ q: 'Where is the milk?', options: ['Aisle 2', 'Aisle 3', 'Aisle 4', 'Aisle 5'], correct: 'Aisle 4' }, { q: 'When does the bakery close?', options: ['5 pm', '6 pm', '7 pm', '8 pm'], correct: '6 pm' }, { q: 'How much is the orange juice?', options: ['£1.50', '£2.00', '£2.50', '£3.00'], correct: '£2.50' }]) },
    { name: 'Weekend Plans', type: LessonType.listening, duration: 25, content: listeningContent('Making Weekend Plans', [{ id: 'A', name: 'Kate' }, { id: 'B', name: 'David' }], [{ speaker: 'A', timeStart: 5, text: 'David, are you free this Saturday?' }, { speaker: 'B', timeStart: 11, text: "I think so. What are you planning?" }, { speaker: 'A', timeStart: 17, text: "A few of us are going to the new Italian restaurant downtown. Would you like to come?" }, { speaker: 'B', timeStart: 26, text: "That sounds great! What time?" }, { speaker: 'A', timeStart: 32, text: "We're meeting at seven o'clock." }, { speaker: 'B', timeStart: 38, text: 'Perfect. I will be there!' }], [{ q: 'Where are they going?', options: ['Cinema', 'Italian restaurant', 'Park', 'Café'], correct: 'Italian restaurant' }, { q: 'What time are they meeting?', options: ['6:00', '6:30', '7:00', '8:00'], correct: '7:00' }, { q: 'Will David go?', options: ['No', 'Maybe', 'Yes', 'He is busy'], correct: 'Yes' }]) },
    { name: 'At the Doctor', type: LessonType.listening, duration: 25, content: listeningContent('At the Doctor', [{ id: 'A', name: 'Doctor' }, { id: 'B', name: 'Patient' }], [{ speaker: 'B', timeStart: 3, text: "Good morning. I don't feel well." }, { speaker: 'A', timeStart: 8, text: 'Good morning. What are your symptoms?' }, { speaker: 'B', timeStart: 14, text: 'I have a headache and a sore throat. I also feel tired.' }, { speaker: 'A', timeStart: 23, text: 'How long have you felt this way?' }, { speaker: 'B', timeStart: 28, text: 'Since yesterday evening.' }, { speaker: 'A', timeStart: 33, text: 'I will prescribe some medicine. Drink lots of water and rest.' }], [{ q: 'What is wrong with the patient?', options: ['Broken arm', 'Headache and sore throat', 'Stomachache', 'Fever only'], correct: 'Headache and sore throat' }, { q: 'How long has the patient felt sick?', options: ['One day', 'Since yesterday evening', 'Two days', 'A week'], correct: 'Since yesterday evening' }, { q: 'What does the doctor say to do?', options: ['Exercise', 'Rest and drink water', 'Eat more', 'Go to hospital'], correct: 'Rest and drink water' }]) },
    { name: 'Daily Activities', type: LessonType.vocabulary, duration: 20, content: vocabularyContent([{ word: 'wake up', translation: 'uyg\'onmoq', example: 'I wake up at 7 every morning.' }, { word: 'have breakfast', translation: 'nonushta qilmoq', example: 'She has breakfast at 8 o\'clock.' }, { word: 'go to work', translation: 'ishga bormoq', example: 'He goes to work by bus.' }, { word: 'have lunch', translation: 'tushlik qilmoq', example: 'We have lunch at 1 pm.' }, { word: 'go to bed', translation: 'yotmoq', example: 'I go to bed at 10 pm.' }]) },
    { name: 'Food and Drink', type: LessonType.vocabulary, duration: 20, content: vocabularyContent([{ word: 'bread', translation: 'non', example: 'I eat bread with butter.' }, { word: 'vegetables', translation: 'sabzavotlar', example: 'Vegetables are good for health.' }, { word: 'juice', translation: 'sharbat', example: 'I drink orange juice every morning.' }, { word: 'rice', translation: 'guruch', example: 'Rice is popular in Asia.' }, { word: 'dessert', translation: 'shirinlik', example: 'We had ice cream for dessert.' }]) },
    { name: 'Places in Town', type: LessonType.vocabulary, duration: 20, content: vocabularyContent([{ word: 'hospital', translation: 'kasalxona', example: 'The hospital is on the main street.' }, { word: 'library', translation: 'kutubxona', example: 'I go to the library to study.' }, { word: 'supermarket', translation: 'supermarket', example: 'We buy food at the supermarket.' }, { word: 'park', translation: 'bog\'', example: 'Children play in the park.' }, { word: 'restaurant', translation: 'restoran', example: 'Let\'s have dinner at a restaurant.' }]) },
    { name: 'Adjectives for Description', type: LessonType.vocabulary, duration: 20, content: vocabularyContent([{ word: 'tall', translation: 'baland bo\'yli', example: 'The building is very tall.' }, { word: 'busy', translation: 'band', example: 'She is always busy.' }, { word: 'delicious', translation: 'mazali', example: 'The food was delicious.' }, { word: 'friendly', translation: 'do\'stona', example: 'The teacher is very friendly.' }, { word: 'beautiful', translation: 'chiroyli', example: 'It is a beautiful day.' }]) },
    { name: 'Time Expressions', type: LessonType.vocabulary, duration: 20, content: vocabularyContent([{ word: 'yesterday', translation: 'kecha', example: 'I went to the cinema yesterday.' }, { word: 'last week', translation: 'o\'tgan hafta', example: 'We had a test last week.' }, { word: 'ago', translation: 'oldin', example: 'He left two hours ago.' }, { word: 'just', translation: 'hozirgina', example: 'I have just finished my homework.' }, { word: 'soon', translation: 'tez orada', example: 'The bus will arrive soon.' }]) },
    { name: 'Unit 2 — Test 1', type: LessonType.test, duration: 30, content: testContent([{ q: 'She ___ dinner when I called. (cook)', options: ['cooks', 'cooked', 'was cooking', 'is cooking'], correct: 'was cooking' }, { q: 'I ___ to London last year.', options: ['go', 'went', 'gone', 'going'], correct: 'went' }, { q: 'There is ___ milk in the fridge.', options: ['many', 'few', 'some', 'any (negative)'], correct: 'some' }, { q: 'This car is ___ than that one. (expensive)', options: ['expensiver', 'most expensive', 'more expensive', 'expensest'], correct: 'more expensive' }, { q: 'He ___ TV yesterday evening.', options: ['watches', 'watch', 'watched', 'is watching'], correct: 'watched' }]) },
    { name: 'Unit 2 — Test 2', type: LessonType.test, duration: 30, content: testContent([{ q: 'We ___ football while it was raining.', options: ['played', 'were playing', 'play', 'plays'], correct: 'were playing' }, { q: 'She ate ___ bread but not much.', options: ['many', 'a few', 'a little', 'much'], correct: 'a little' }, { q: 'This film is ___ than the last one. (good)', options: ['more good', 'gooder', 'better', 'best'], correct: 'better' }, { q: 'The milk is in aisle ___', options: ['two', 'three', 'four', 'five'], correct: 'four' }, { q: 'Yesterday I ___ my keys.', options: ['loose', 'loosed', 'lost', 'losing'], correct: 'lost' }]) },
    { name: 'Some and Any', type: LessonType.grammar, duration: 15, content: grammarContent('Some and Any', "Some va any — miqdorni ifodalash.", ['some/any', '+', 'Noun'], { en: 'Do you have any questions?', uz: 'Savolingiz bormi?', keyword: 'any' }, [{ title: 'Some — musbat', body: "Musbat gaplarda some ishlatiladi: I have some money." }, { title: 'Any — so\'roq/inkor', body: "So'roq va inkor gaplarda any: I don't have any idea." }]) },
    { name: 'The Old House', type: LessonType.reading, duration: 20, content: readingContent('The Old House', 'Robert Nash', ['The old house stood at the end of a quiet street. It had large windows and a big garden.', 'Nobody lived there for ten years. People said it was haunted, but nobody really believed it.', 'One day a young family moved in. They painted the walls white and planted flowers.', 'The garden bloomed in spring. Children came to play on the green grass.', 'The house was old but it had a new life now, full of laughter and colour.'], [{ q: 'How long was the house empty?', options: ['5 years', '8 years', '10 years', '15 years'], correct: '10 years' }, { q: 'What did the family paint?', options: ['The roof', 'The fence', 'The walls', 'The door'], correct: 'The walls' }, { q: 'What did the garden look like in spring?', options: ['Empty', 'Full of flowers', 'Dark', 'Covered in snow'], correct: 'Full of flowers' }]) },
    { name: 'Neighbourhood Chat', type: LessonType.listening, duration: 25, content: listeningContent('Neighbourhood Chat', [{ id: 'A', name: 'Mary' }, { id: 'B', name: 'Peter' }], [{ speaker: 'A', timeStart: 2, text: 'Peter! Did you hear about the new café on Baker Street?' }, { speaker: 'B', timeStart: 8, text: 'Yes! I went there yesterday. The coffee was excellent.' }, { speaker: 'A', timeStart: 15, text: 'Really? How much was it?' }, { speaker: 'B', timeStart: 20, text: "Just three pounds for a large cup. They also have amazing cakes." }, { speaker: 'A', timeStart: 28, text: 'I will go tomorrow. Do you want to join me?' }, { speaker: 'B', timeStart: 34, text: 'Sure! How about 10 in the morning?' }], [{ q: 'Where is the new café?', options: ['High Street', 'Baker Street', 'Main Road', 'Park Avenue'], correct: 'Baker Street' }, { q: 'How much does a large coffee cost?', options: ['£2', '£2.50', '£3', '£3.50'], correct: '£3' }, { q: 'When will they go?', options: ['Today at 10', 'Tomorrow at 10', 'Tomorrow at 11', 'This evening'], correct: 'Tomorrow at 10' }]) },
  ];
}

function buildGenericUnit(unitNum: number, unitTitle: string): LessonDef[] {
  const topics = [
    { g: `Future Simple — bo'lajak zamon`, gDesc: "Will + verb — kelajakdagi harakatlar.", gEx: { en: 'I will travel to London next year.', uz: 'Men kelasi yili Londonga boraman.', keyword: 'will travel' }, gRule: [{ title: 'Will + verb (base)', body: 'I will go, She will come, They will be' }] },
    { g: 'Present Perfect', gDesc: "Have/has + past participle — o'tmish tajribasi.", gEx: { en: 'I have visited Paris twice.', uz: 'Men Parijga ikki marta borgman.', keyword: 'have visited' }, gRule: [{ title: 'Ever/Never', body: 'Have you ever been to London? I have never tried sushi.' }] },
    { g: 'Modal Verbs', gDesc: "Can, must, should — zaruratni ifodalash.", gEx: { en: 'You should study harder.', uz: 'Siz ko\'proq o\'qishingiz kerak.', keyword: 'should' }, gRule: [{ title: 'Modal + verb base', body: 'She can swim. He must leave. You should rest.' }] },
    { g: 'Conditionals Type 1', gDesc: "If + Present Simple, will — real holat.", gEx: { en: 'If it rains, I will stay home.', uz: 'Yomg\'ir yog\'sa, uyda qolaman.', keyword: 'will stay' }, gRule: [{ title: 'Real condition', body: 'If clause: Present Simple; Main clause: will + verb' }] },
    { g: 'Passive Voice', gDesc: "Be + past participle — passiv tuzilma.", gEx: { en: 'The book was written by Mark Twain.', uz: 'Kitob Mark Tven tomonidan yozilgan.', keyword: 'was written' }, gRule: [{ title: 'Passive formation', body: 'Active: She writes the report. Passive: The report is written by her.' }] },
    { g: 'Conditionals Type 2', gDesc: "If + Past Simple, would — unreal holat.", gEx: { en: 'If I had money, I would travel.', uz: 'Pulim bo\'lsa, sayohat qilardim.', keyword: 'would travel' }, gRule: [{ title: 'Unreal present', body: 'If clause: Past Simple; Main clause: would + verb' }] },
  ];

  const t = topics[(unitNum - 1) % topics.length];
  const t2 = topics[unitNum % topics.length];
  const t3 = topics[(unitNum + 1) % topics.length];
  const t4 = topics[(unitNum + 2) % topics.length];
  const t5 = topics[(unitNum + 3) % topics.length];

  const readingTexts = [
    { title: `${unitTitle} — Reading 1`, author: 'English Author', paras: [`This is a text about ${unitTitle.toLowerCase()}.`, `Students learn many useful things in this unit.`, `Vocabulary and grammar are both important.`, `Practice every day to improve your English.`, `By the end of this unit you will be more confident.`] },
    { title: `${unitTitle} — Reading 2`, author: 'Language Teacher', paras: [`Unit ${unitNum} focuses on practical language skills.`, `Reading helps you understand real English.`, `Each paragraph introduces new vocabulary and structures.`, `Try to understand the main idea of each paragraph.`, `Then answer the comprehension questions carefully.`] },
    { title: `${unitTitle} — Reading 3`, author: 'Journalist', paras: [`People communicate in many different ways.`, `Language is the most important tool we have.`, `Every language has its own rules and structures.`, `Learning grammar helps you to be more accurate.`, `Practice makes perfect — never stop learning!`] },
    { title: `${unitTitle} — Reading 4`, author: 'Writer', paras: [`This passage is part of unit ${unitNum}.`, `It reviews important language from previous lessons.`, `Reading regularly improves your skills quickly.`, `Try to read in English every day for best results.`, `Your confidence will grow with every page you read.`] },
  ];

  const listeningData = [
    { title: `Unit ${unitNum} — Conversation 1`, sp: [{ id: 'A', name: 'Anna' }, { id: 'B', name: 'Mike' }], tr: [{ speaker: 'A', timeStart: 5, text: `Hello! Let's talk about ${unitTitle.toLowerCase()}.` }, { speaker: 'B', timeStart: 12, text: 'Sure, I find this topic very interesting.' }, { speaker: 'A', timeStart: 20, text: 'What did you learn in this unit?' }, { speaker: 'B', timeStart: 28, text: 'I learned a lot of new vocabulary and grammar structures.' }] },
    { title: `Unit ${unitNum} — Conversation 2`, sp: [{ id: 'A', name: 'Sophie' }, { id: 'B', name: 'Ben' }], tr: [{ speaker: 'A', timeStart: 4, text: 'Did you finish the exercises?' }, { speaker: 'B', timeStart: 10, text: 'Yes, they were challenging but useful.' }, { speaker: 'A', timeStart: 18, text: 'Which exercise was the hardest?' }, { speaker: 'B', timeStart: 25, text: 'The grammar exercise was difficult, but I understood it in the end.' }] },
    { title: `Unit ${unitNum} — Conversation 3`, sp: [{ id: 'A', name: 'Laura' }, { id: 'B', name: 'Chris' }], tr: [{ speaker: 'A', timeStart: 3, text: 'I love learning English.' }, { speaker: 'B', timeStart: 9, text: 'Me too! It opens so many doors.' }, { speaker: 'A', timeStart: 16, text: `In unit ${unitNum} we covered some great topics.` }, { speaker: 'B', timeStart: 24, text: 'The listening exercises really helped me improve.' }] },
    { title: `Unit ${unitNum} — Conversation 4`, sp: [{ id: 'A', name: 'James' }, { id: 'B', name: 'Emma' }], tr: [{ speaker: 'A', timeStart: 5, text: 'Are you ready for the test?' }, { speaker: 'B', timeStart: 11, text: "I think so. I've been studying all week." }, { speaker: 'A', timeStart: 18, text: 'Make sure you review the vocabulary.' }, { speaker: 'B', timeStart: 25, text: 'Yes, and the grammar rules too. I want to get a good score.' }] },
  ];

  const stdQ = [{ q: 'What is the main topic?', options: [`${unitTitle}`, 'Weather', 'Sports', 'Music'], correct: unitTitle }, { q: 'Is reading important?', options: ['No', 'Sometimes', 'Yes', 'Never'], correct: 'Yes' }, { q: 'How can you improve?', options: ['Sleep more', 'Practice daily', 'Skip lessons', 'Watch TV only'], correct: 'Practice daily' }];
  const lisQ = [{ q: 'What are they talking about?', options: [`Unit ${unitNum}`, 'Food', 'Travel', 'Sports'], correct: `Unit ${unitNum}` }, { q: 'Did they find it useful?', options: ['No', 'Maybe', 'Yes', 'Never'], correct: 'Yes' }, { q: 'What should you review?', options: ['Nothing', 'Grammar and vocab', 'Only vocab', 'Only grammar'], correct: 'Grammar and vocab' }];

  const vocabSets = [
    [{ word: 'experience', translation: 'tajriba', example: 'Learning English is a great experience.' }, { word: 'improve', translation: 'yaxshilamoq', example: 'I want to improve my speaking skills.' }, { word: 'achieve', translation: 'erishmoq', example: 'You can achieve your goals with hard work.' }, { word: 'challenge', translation: 'qiyinlik', example: 'Grammar can be a challenge.' }, { word: 'confident', translation: 'ishonchli', example: 'She feels confident about the test.' }],
    [{ word: 'communicate', translation: 'muloqot qilmoq', example: 'We communicate by speaking and writing.' }, { word: 'understand', translation: 'tushunmoq', example: 'I understand the grammar rule now.' }, { word: 'vocabulary', translation: 'lug\'at', example: 'Building vocabulary takes time.' }, { word: 'structure', translation: 'tuzilma', example: 'Every sentence has a structure.' }, { word: 'fluent', translation: 'ravon', example: 'She speaks English fluently.' }],
    [{ word: 'grammar', translation: 'grammatika', example: 'Good grammar makes you clear.' }, { word: 'accuracy', translation: 'aniqlik', example: 'Accuracy is important in writing.' }, { word: 'progress', translation: 'taraqqiyot', example: 'I can see my progress every week.' }, { word: 'review', translation: 'takrorlamoq', example: 'Review your notes before the test.' }, { word: 'practise', translation: 'mashq qilmoq', example: 'Practise English every day.' }],
    [{ word: 'opinion', translation: 'fikr', example: 'In my opinion, English is useful.' }, { word: 'discuss', translation: 'muhokama qilmoq', example: 'We discussed the topic in class.' }, { word: 'describe', translation: 'tasvirlamoq', example: 'Can you describe the picture?' }, { word: 'compare', translation: 'taqqoslamoq', example: 'Compare these two sentences.' }, { word: 'explain', translation: 'tushuntirmoq', example: 'Please explain your answer.' }],
    [{ word: 'organize', translation: 'tashkil etmoq', example: 'Organize your ideas before writing.' }, { word: 'complete', translation: 'tugallamoq', example: 'Complete the exercise in 10 minutes.' }, { word: 'include', translation: 'kiritmoq', example: 'Include examples in your answer.' }, { word: 'require', translation: 'talab qilmoq', example: 'This task requires careful reading.' }, { word: 'support', translation: 'qo\'llab-quvvatlamoq', example: 'Support your argument with examples.' }],
  ];

  const r = readingTexts;

  return [
    { name: `${t.g} — asoslar`, type: LessonType.grammar, duration: 15, content: grammarContent(t.g, t.gDesc, ['Subject', '+', 'Verb', '+', 'Object'], t.gEx, t.gRule) },
    { name: `${t2.g} — amaliyot`, type: LessonType.grammar, duration: 15, content: grammarContent(t2.g, t2.gDesc, ['Subject', '+', 'Auxiliary', '+', 'Verb', '+', 'Object'], t2.gEx, t2.gRule) },
    { name: `${t3.g} — kengaytma`, type: LessonType.grammar, duration: 15, content: grammarContent(t3.g, t3.gDesc, ['If/When', '+', 'Clause', '+', 'Result'], t3.gEx, t3.gRule) },
    { name: `${t4.g} — takrorlash`, type: LessonType.grammar, duration: 15, content: grammarContent(t4.g, t4.gDesc, ['Subject', '+', 'Verb', '+', 'Complement'], t4.gEx, t4.gRule) },
    { name: r[0].title, type: LessonType.reading, duration: 20, content: readingContent(r[0].title, r[0].author, r[0].paras, stdQ) },
    { name: r[1].title, type: LessonType.reading, duration: 20, content: readingContent(r[1].title, r[1].author, r[1].paras, stdQ) },
    { name: r[2].title, type: LessonType.reading, duration: 20, content: readingContent(r[2].title, r[2].author, r[2].paras, stdQ) },
    { name: listeningData[0].title, type: LessonType.listening, duration: 25, content: listeningContent(listeningData[0].title, listeningData[0].sp, listeningData[0].tr, lisQ) },
    { name: listeningData[1].title, type: LessonType.listening, duration: 25, content: listeningContent(listeningData[1].title, listeningData[1].sp, listeningData[1].tr, lisQ) },
    { name: listeningData[2].title, type: LessonType.listening, duration: 25, content: listeningContent(listeningData[2].title, listeningData[2].sp, listeningData[2].tr, lisQ) },
    { name: `${unitTitle} — Vocabulary 1`, type: LessonType.vocabulary, duration: 20, content: vocabularyContent(vocabSets[0]) },
    { name: `${unitTitle} — Vocabulary 2`, type: LessonType.vocabulary, duration: 20, content: vocabularyContent(vocabSets[1]) },
    { name: `${unitTitle} — Vocabulary 3`, type: LessonType.vocabulary, duration: 20, content: vocabularyContent(vocabSets[2]) },
    { name: `${unitTitle} — Vocabulary 4`, type: LessonType.vocabulary, duration: 20, content: vocabularyContent(vocabSets[3]) },
    { name: `${unitTitle} — Vocabulary 5`, type: LessonType.vocabulary, duration: 20, content: vocabularyContent(vocabSets[4]) },
    { name: `Unit ${unitNum} — Test 1`, type: LessonType.test, duration: 30, content: testContent([{ q: `Which is correct for "${t.g}"?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option A' }, { q: 'Fill in: She ___ (go) to school.', options: ['go', 'goes', 'going', 'gone'], correct: 'goes' }, { q: 'Choose the right structure.', options: ['will + verb', 'will + verb-ing', 'will + past', 'will + infinitive'], correct: 'will + verb' }, { q: 'Passive: The letter ___ by her.', options: ['write', 'wrote', 'was written', 'is write'], correct: 'was written' }, { q: 'If I had time, I ___ read more.', options: ['will', 'would', 'can', 'shall'], correct: 'would' }]) },
    { name: `Unit ${unitNum} — Test 2`, type: LessonType.test, duration: 30, content: testContent([{ q: 'Have you ever ___ to Paris?', options: ['go', 'went', 'gone', 'going'], correct: 'gone' }, { q: 'You ___ study if you want to pass.', options: ['can', 'may', 'must', 'would'], correct: 'must' }, { q: 'If it snows, we ___ stay inside.', options: ['will', 'would', 'shall', 'can'], correct: 'will' }, { q: 'Choose the better sentence.', options: ['She has gone.', 'She have gone.', 'She is gone.', 'She was go.'], correct: 'She has gone.' }, { q: 'He ___ speak French very well.', options: ['can', 'is', 'has', 'have'], correct: 'can' }]) },
    { name: `${t5.g} — yig'indisi`, type: LessonType.grammar, duration: 15, content: grammarContent(t5.g, t5.gDesc, ['Subject', '+', 'Verb phrase', '+', 'Object'], t5.gEx, t5.gRule) },
    { name: r[3].title, type: LessonType.reading, duration: 20, content: readingContent(r[3].title, r[3].author, r[3].paras, stdQ) },
    { name: listeningData[3].title, type: LessonType.listening, duration: 25, content: listeningContent(listeningData[3].title, listeningData[3].sp, listeningData[3].tr, lisQ) },
  ];
}

// ── Main seed function ────────────────────────────────────────────────────────

async function seed() {
  await ds.initialize();
  console.log('✅ Database connected');

  const userRepo = ds.getRepository(User);
  const gamRepo = ds.getRepository(UserGamification);
  const achRepo = ds.getRepository(Achievement);
  const unitRepo = ds.getRepository(Unit);
  const lessonRepo = ds.getRepository(Lesson);
  const groupRepo = ds.getRepository(Group);
  const scheduleRepo = ds.getRepository(Schedule);
  const vocabRepo = ds.getRepository(Vocabulary);

  // ── 1. Achievements ─────────────────────────────────────────────────────────
  const achDefs = [
    { code: 'first_lesson', title: 'Birinchi dars', description: 'Birinchi darsni yakunladi', icon: '🎯', xpReward: 20, conditionType: AchievementCondition.lessons, conditionValue: 1 },
    { code: 'streak_3', title: '3 kunlik ketma-ketlik', description: '3 kun ketma-ket o\'qidi', icon: '🔥', xpReward: 30, conditionType: AchievementCondition.streak, conditionValue: 3 },
    { code: 'streak_7', title: '7 kunlik ketma-ketlik', description: '7 kun ketma-ket o\'qidi', icon: '⚡', xpReward: 70, conditionType: AchievementCondition.streak, conditionValue: 7 },
    { code: 'streak_30', title: '30 kunlik ketma-ketlik', description: '30 kun ketma-ket o\'qidi', icon: '🏆', xpReward: 300, conditionType: AchievementCondition.streak, conditionValue: 30 },
    { code: 'words_50', title: '50 ta so\'z', description: '50 ta so\'z o\'rgandi', icon: '📚', xpReward: 50, conditionType: AchievementCondition.vocabulary, conditionValue: 50 },
    { code: 'words_100', title: '100 ta so\'z', description: '100 ta so\'z o\'rgandi', icon: '📖', xpReward: 100, conditionType: AchievementCondition.vocabulary, conditionValue: 100 },
    { code: 'words_500', title: '500 ta so\'z', description: '500 ta so\'z o\'rgandi', icon: '🎓', xpReward: 500, conditionType: AchievementCondition.vocabulary, conditionValue: 500 },
    { code: 'perfect_score', title: 'Mukammal ball', description: "100 ball to'pladi", icon: '⭐', xpReward: 100, conditionType: AchievementCondition.score, conditionValue: 100 },
    { code: 'fast_learner', title: 'Tez o\'rganuvchi', description: '10 ta darsni yakunladi', icon: '🚀', xpReward: 80, conditionType: AchievementCondition.lessons, conditionValue: 10 },
  ];

  for (const def of achDefs) {
    const existing = await achRepo.findOne({ where: { code: def.code } });
    if (!existing) {
      await achRepo.save(achRepo.create(def));
    }
  }
  console.log('✅ Achievements: 9 ta yaratildi');

  // ── 2. Users ─────────────────────────────────────────────────────────────────
  const userDefs = [
    { firstName: 'Admin', lastName: 'User', username: 'admin', password: 'Admin123', role: Role.admin },
    { firstName: 'Teacher', lastName: 'One', username: 'teacher1', password: 'Teacher123', role: Role.teacher },
    { firstName: 'Teacher', lastName: 'Two', username: 'teacher2', password: 'Teacher123', role: Role.teacher },
    { firstName: 'Student', lastName: 'One', username: 'student1', password: 'Student123', role: Role.student },
    { firstName: 'Student', lastName: 'Two', username: 'student2', password: 'Student123', role: Role.student },
    { firstName: 'Student', lastName: 'Three', username: 'student3', password: 'Student123', role: Role.student },
    { firstName: 'Student', lastName: 'Four', username: 'student4', password: 'Student123', role: Role.student },
    { firstName: 'Student', lastName: 'Five', username: 'student5', password: 'Student123', role: Role.student },
  ];

  const createdUsers: User[] = [];
  for (const def of userDefs) {
    let user = await userRepo.findOne({ where: { username: def.username } });
    if (!user) {
      const hashed = await bcrypt.hash(def.password, 10);
      user = await userRepo.save(
        userRepo.create({ ...def, password: hashed, createdBy: '00000000-0000-0000-0000-000000000000' }),
      );
      const existing = await gamRepo.findOne({ where: { userId: user.id } });
      if (!existing) {
        await gamRepo.save(gamRepo.create({ userId: user.id, level: 1, xpTotal: 0, xpWeekly: 0, league: League.bronze, streakCurrent: 0, streakMax: 0 }));
      }
    }
    createdUsers.push(user);
  }
  console.log('✅ Users: 8 ta + Gamification');

  const [, teacher1, , student1, student2, student3] = createdUsers;

  // ── 3. Units ──────────────────────────────────────────────────────────────────
  const unitDefs = [
    { number: 1, title: 'Asoslar va tanishuv', description: 'Ingliz tilining asosiy grammatikasi va so\'zlashuv iboralari', orderIndex: 0 },
    { number: 2, title: 'Kundalik hayot', description: 'Kundalik faoliyatlar, oziq-ovqat, do\'konlar va joy', orderIndex: 1 },
    { number: 3, title: 'Sayohat va o\'rinlar', description: 'Sayohat, transport, mehmonxona va yo\'nalishlar', orderIndex: 2 },
    { number: 4, title: 'Ish va ta\'lim', description: 'Ish joyidagi muloqot, ta\'lim va karyera', orderIndex: 3 },
    { number: 5, title: 'Jamiyat va madaniyat', description: 'Jamiyat, madaniyat, san\'at va ommaviy axborot vositalari', orderIndex: 4 },
    { number: 6, title: 'Ilg\'or mavzular', description: 'Murakkab grammatika, akademik yozuv va muhokama', orderIndex: 5 },
  ];

  const createdUnits: Unit[] = [];
  for (const def of unitDefs) {
    let unit = await unitRepo.findOne({ where: { number: def.number } });
    if (!unit) {
      unit = await unitRepo.save(unitRepo.create({ ...def, status: LessonStatus.published }));
    }
    createdUnits.push(unit);
  }
  console.log('✅ Units: 6 ta yaratildi');

  // ── 4. Lessons ────────────────────────────────────────────────────────────────
  const allLessonDefs: { unit: Unit; defs: LessonDef[] }[] = [
    { unit: createdUnits[0], defs: buildUnit1Lessons() },
    { unit: createdUnits[1], defs: buildUnit2Lessons() },
    { unit: createdUnits[2], defs: buildGenericUnit(3, 'Sayohat va o\'rinlar') },
    { unit: createdUnits[3], defs: buildGenericUnit(4, 'Ish va ta\'lim') },
    { unit: createdUnits[4], defs: buildGenericUnit(5, 'Jamiyat va madaniyat') },
    { unit: createdUnits[5], defs: buildGenericUnit(6, 'Ilg\'or mavzular') },
  ];

  let totalLessons = 0;
  for (const { unit, defs } of allLessonDefs) {
    const existing = await lessonRepo.count({ where: { unitId: unit.id } });
    if (existing >= 20) {
      console.log(`  ⏭  Unit ${unit.number}: already has ${existing} lessons, skipping`);
      totalLessons += existing;
      continue;
    }
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      await lessonRepo.save(
        lessonRepo.create({
          unitId: unit.id,
          lessonNumber: String(i + 1),
          lessonName: def.name,
          orderIndex: i,
          status: LessonStatus.published,
        }),
      );
      totalLessons++;
    }
    console.log(`  ✅ Unit ${unit.number}: 20 ta dars yaratildi`);
  }
  console.log(`✅ Lessons: jami ${totalLessons} ta`);

  // ── 5. Group + Members + Schedule ────────────────────────────────────────────
  let group = await groupRepo.findOne({ where: { name: '1-guruh' } });
  if (!group) {
    group = await groupRepo.save(
      groupRepo.create({
        name: '1-guruh',
        color: 'blue',
        teacherId: teacher1.id,
        createdBy: teacher1.id,
        members: [student1, student2, student3],
      }),
    );

    await scheduleRepo.save(
      scheduleRepo.create({
        groupId: group.id,
        teacherId: teacher1.id,
        daysOfWeek: JSON.stringify([0, 2, 4]),
        startTime: '14:00',
        durationMinutes: 90,
        isRecurring: true,
        validFrom: new Date().toISOString().split('T')[0],
        topic: 'English B1',
      }),
    );
    console.log('✅ Group "1-guruh" + 3 talaba + schedule yaratildi');
  } else {
    console.log('⏭  Group: allaqachon mavjud');
  }

  // ── 6. Vocabulary Words (50+) ────────────────────────────────────────────────
  const existingVocab = await vocabRepo.count();
  if (existingVocab >= 50) {
    console.log(`⏭  Vocabulary: allaqachon ${existingVocab} ta so'z mavjud`);
  } else {
    const vocabData = [
      // A1
      { word: 'book', uzbekTranslation: 'kitob', example: 'I read a book every night.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'table', uzbekTranslation: 'stol', example: 'We eat at the table.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'house', uzbekTranslation: 'uy', example: 'I live in a small house.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'happy', uzbekTranslation: 'xursand', example: 'She looks happy today.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      { word: 'small', uzbekTranslation: 'kichik', example: 'My cat is small.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      { word: 'walk', uzbekTranslation: 'yurmoq', example: 'We walk to school.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.verb },
      { word: 'write', uzbekTranslation: 'yozmoq', example: 'I write in my notebook.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.verb },
      { word: 'fast', uzbekTranslation: 'tez', example: 'He runs fast.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adverb },
      { word: 'always', uzbekTranslation: 'doim', example: 'I always drink coffee in the morning.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adverb },
      { word: 'open', uzbekTranslation: 'ochmoq', example: 'Please open the window.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.verb },
      { word: 'chair', uzbekTranslation: 'stul', example: 'Sit on the chair.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'dog', uzbekTranslation: 'it', example: 'I have a small dog.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'cat', uzbekTranslation: 'mushuk', example: 'The cat sleeps all day.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'water', uzbekTranslation: 'suv', example: 'Drink more water.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.noun },
      { word: 'big', uzbekTranslation: 'katta', example: 'London is a big city.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      { word: 'new', uzbekTranslation: 'yangi', example: 'I bought a new phone.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      { word: 'good', uzbekTranslation: 'yaxshi', example: 'This is a good idea.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      { word: 'old', uzbekTranslation: 'eski/katta yoshli', example: 'My grandfather is old.', cefrLevel: CefrLevel.A1, pos: PartOfSpeech.adjective },
      // A2
      { word: 'market', uzbekTranslation: 'bozor', example: 'We buy food at the market.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'appointment', uzbekTranslation: 'uchrashuv/qabul', example: 'I have a doctor appointment today.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'exercise', uzbekTranslation: 'mashq/jismoniy faoliyat', example: 'I exercise every morning.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.verb },
      { word: 'arrive', uzbekTranslation: 'yetib kelmoq', example: 'The train will arrive at 5.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.verb },
      { word: 'delicious', uzbekTranslation: 'juda mazali', example: 'This cake is delicious.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      { word: 'crowded', uzbekTranslation: 'gavjum', example: 'The market was very crowded.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      { word: 'healthy', uzbekTranslation: "sog'lom", example: 'Eating vegetables is healthy.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      { word: 'careful', uzbekTranslation: 'ehtiyotkor', example: 'Be careful on the road.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      { word: 'remember', uzbekTranslation: 'eslamoq', example: 'Do you remember her name?', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.verb },
      { word: 'spend', uzbekTranslation: 'sarflamoq', example: 'I spend a lot of money on books.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.verb },
      { word: 'journey', uzbekTranslation: "sayohat/yo'l", example: 'The journey took three hours.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'luggage', uzbekTranslation: 'bagaj', example: 'I have heavy luggage.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'comfortable', uzbekTranslation: 'qulay', example: 'This seat is very comfortable.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      { word: 'passport', uzbekTranslation: 'pasport', example: 'I need my passport to fly.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'tourist', uzbekTranslation: 'sayyoh', example: 'Many tourists visit London.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'adventure', uzbekTranslation: 'sarguzasht', example: 'Traveling is a great adventure.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'explore', uzbekTranslation: 'kashf etmoq', example: 'We explored the old city.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.verb },
      { word: 'souvenir', uzbekTranslation: "esdalik sovg'a", example: 'I bought a souvenir from Paris.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'reservation', uzbekTranslation: 'bron qilish', example: 'I made a reservation at the hotel.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.noun },
      { word: 'local', uzbekTranslation: 'mahalliy', example: 'Ask a local person for directions.', cefrLevel: CefrLevel.A2, pos: PartOfSpeech.adjective },
      // B1
      { word: 'departure', uzbekTranslation: 'ketish vaqti', example: 'The departure time is 9 am.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'destination', uzbekTranslation: 'manzil', example: 'Paris is our final destination.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'recommend', uzbekTranslation: 'tavsiya etmoq', example: 'I recommend this hotel.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.verb },
      { word: 'currency', uzbekTranslation: 'valyuta', example: 'I need to exchange currency.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'scenery', uzbekTranslation: 'manzara', example: 'The scenery in the mountains is breathtaking.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'itinerary', uzbekTranslation: 'sayohat rejasi', example: 'I planned a detailed itinerary.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'accommodation', uzbekTranslation: 'turar joy', example: 'We booked accommodation in advance.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'memorable', uzbekTranslation: 'esda qoluvchi', example: 'It was a memorable trip.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.adjective },
      { word: 'distant', uzbekTranslation: 'uzoq', example: 'They live in a distant country.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.adjective },
      { word: 'culture', uzbekTranslation: 'madaniyat', example: 'I love learning about other cultures.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.noun },
      { word: 'authentic', uzbekTranslation: 'haqiqiy', example: 'I tried authentic Italian food.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.adjective },
      { word: 'navigate', uzbekTranslation: "yo'nalish tanlash", example: 'It is easy to navigate with a map.', cefrLevel: CefrLevel.B1, pos: PartOfSpeech.verb },
    ];

    for (const v of vocabData) {
      const existing = await vocabRepo.findOne({ where: { word: v.word } });
      if (!existing) {
        await vocabRepo.save(vocabRepo.create(v));
      }
    }
    console.log(`✅ Vocabulary words: ${vocabData.length} ta yaratildi`);
  }

  await ds.destroy();
  console.log('\n🎉 Seed muvaffaqiyatli yakunlandi!');
  console.log('   admin/Admin123 · teacher1/Teacher123 · student1/Student123');
}

seed().catch((err) => {
  console.error('❌ Seed xato:', err);
  process.exit(1);
});
