# ระบบฐานข้อมูลรายวิชา Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เว็บค้นหาและดูแลข้อมูลรายวิชาหลักสูตร ปวส. 2567 สาขาเทคโนโลยีสารสนเทศ โดยนำเข้าข้อมูลครั้งเดียวจาก `Data/31901v7_18_10_68.pdf`

**Architecture:** แอป Next.js ตัวเดียว (App Router) อ่านข้อมูลผ่าน Server Components → `lib/courses.ts` → Prisma → PostgreSQL ใน Docker; เขียนข้อมูลผ่าน Server Actions ที่ผ่าน `lib/authz.ts` ทุกตัว สคริปต์ `tsx` แยกข้อมูลจาก PDF เป็น JSON กลางให้คนตรวจก่อน seed

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4 + shadcn/ui, Prisma 6, PostgreSQL 16, Auth.js v5 (`next-auth@beta`), zod, bcryptjs, exceljs, Recharts, pdfjs-dist 4.10.38, tsx, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-11-12-course-database-design.md`

## Global Constraints

- ข้อความบนหน้าเว็บทั้งหมดเป็นภาษาไทย; `<html lang="th">`
- นำเข้าเฉพาะหน้า 37–106 ของ PDF; ไม่มีผู้สอน/ตารางเรียน/ภาคเรียน
- บทบาทมีสองค่า `ADMIN` และ `STAFF`; ไม่มีหน้าสมัครสมาชิก
- Server Action ทุกตัวเรียก `requireRole` เอง ห้ามพึ่ง middleware อย่างเดียว
- แบ่งหน้า 20 รายการ; สถานะค้นหา/กรองอยู่ใน query string (`q`, `category`, `credits`, `page`)
- ส่งออก PDF ใช้หน้า `/print` + การพิมพ์ของเบราว์เซอร์ ห้ามเพิ่มไลบรารีสร้าง PDF
- Postgres: image `postgres:16`, ฐานข้อมูล `courses` (ใช้งาน) และ `courses_test` (ทดสอบ), ผู้ใช้/รหัสผ่าน `courses`/`courses`, พอร์ต 5432
- ข้อความตายตัวที่การทดสอบอ้างถึง:
  - ล็อกอินผิด: `อีเมลหรือรหัสผ่านไม่ถูกต้อง`
  - รหัสวิชาซ้ำ: `รหัสวิชานี้มีอยู่แล้ว`
  - ค้นหาไม่เจอ: `ไม่พบรายวิชาที่ตรงกับเงื่อนไข` พร้อมปุ่ม `ล้างตัวกรอง`
  - ลบหมวดไม่ได้: `ลบไม่ได้: ยังมีรายวิชาหรือหมวดย่อยอยู่`
  - ADMIN คนสุดท้าย: `ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งคน`
- ทุก commit ลงท้ายด้วย `Co-Authored-By: Claude <noreply@anthropic.com>`

**ส่วนที่ต่างจาก spec (พฤติกรรมเท่าเดิม):**
- สคริปต์เป็น TypeScript รันด้วย `tsx` และ `normalizeThai` อยู่ที่ `lib/normalize-thai.ts` เพื่อให้ช่องค้นหาบนเว็บใช้ฟังก์ชันเดียวกันได้
- "ไม่เขียนทับวิชาที่แก้แล้ว" ใช้คอลัมน์ `editedAt` (ตั้งค่าเมื่อแก้ผ่านเว็บ) แทนการเทียบ `updatedAt > createdAt` ซึ่งสองค่านั้นอาจต่างกันระดับมิลลิวินาทีตั้งแต่ตอนสร้าง

## Review Focus

1. ผู้ใช้ที่ถูกปิดการใช้งานหรือถูกลดบทบาท แต่ยังมี session เดิมค้างอยู่ → action ถัดไปต้องถูกปฏิเสธทันที (Task 8)
2. คำค้นที่มี `%`, `_`, `\`, ช่องว่างล้วน, หรือสระอำแบบแยกตัว (`ํ`+`า`) → `%`/`_` ถือเป็นตัวอักษรธรรมดา, ช่องว่างล้วนเท่ากับไม่ค้น, สระอำแบบแยกตัวยังค้นเจอ (Task 5)
3. `page` ที่ไม่ใช่ตัวเลข ติดลบ หรือเกินหน้าสุดท้าย และ `category`/`credits` ที่ไม่มีจริง → ไม่ล้ม; page ถูกบีบเข้าช่วง, ตัวกรองที่ไม่รู้จักถูกเพิกเฉย (Task 5)
4. ส่งออก Excel เมื่อผลค้นหาว่าง หรือมีมากกว่า 20 รายการ → ได้ไฟล์ที่เปิดได้ มีหัวตารางเสมอ และมีครบทุกแถว ไม่ใช่เฉพาะหน้าปัจจุบัน (Task 7)
5. แถวรายวิชาใน PDF ที่ชื่อลงท้ายด้วยตัวเลข (เช่น "กิจกรรมองค์การวิชาชีพ 1" ตามด้วย `0-2-0`) หรือที่ชื่อไทยอยู่คนละ baseline กับรหัส (ต่างกัน 3pt) → เลขท้ายชื่อไม่ถูกกลืนเป็นชั่วโมง และชื่อไม่หลุด (Task 3)

---

## โครงสร้างไฟล์

```
docker-compose.yml, .env.example, vitest.config.ts, playwright.config.ts
prisma/schema.prisma, prisma/seed.ts
lib/db.ts                  PrismaClient singleton
lib/normalize-thai.ts      แก้ข้อความไทยเพี้ยน
lib/courses.ts             ค้นหา กรอง สถิติ ต้นไม้หมวด
lib/export.ts              ผลค้นหา → xlsx
lib/authz.ts               requireRole
lib/users.ts               กฎจัดการผู้ใช้ (ADMIN คนสุดท้าย)
lib/validation.ts          zod schema ของฟอร์ม
auth.config.ts, auth.ts, middleware.ts
scripts/pdf/lines.ts       text items → บรรทัด
scripts/pdf/parse.ts       บรรทัด → รายวิชา/หมวด
scripts/pdf/extract.ts     CLI
app/(public)/page.tsx, courses/[code]/page.tsx, dashboard/page.tsx, print/page.tsx
app/api/export/route.ts
app/login/page.tsx
app/admin/{page,courses,categories,users,account}/…  + actions.ts ในแต่ละโฟลเดอร์
components/…               ตาราง ฟอร์ม ตัวกรอง กราฟ
tests/unit, tests/db, tests/e2e, tests/fixtures
```

---

### Task 1: โครงโปรเจกต์ ฐานข้อมูล และ schema

**Files:**
- Create: โครง Next.js ทั้งหมด, `docker-compose.yml`, `.env.example`, `.env`, `prisma/schema.prisma`, `lib/db.ts`, `vitest.config.ts`, `tests/db/setup.ts`, `tests/db/schema.test.ts`
- Modify: `package.json`, `.gitignore`

**Interfaces:**
- Produces: `import { db } from "@/lib/db"` (PrismaClient); โมเดล Prisma `Category`, `Course`, `User`, enum `Role`; สคริปต์ npm `test` (เฉพาะ `tests/unit`), `test:db` (เฉพาะ `tests/db` กับ `courses_test`), `extract`

- [ ] **Step 1: สร้างโครง Next.js ลงในโฟลเดอร์ที่ไม่ว่าง**

`create-next-app` ปฏิเสธโฟลเดอร์ที่มี `package.json` อยู่แล้ว จึงสร้างในโฟลเดอร์ชั่วคราวแล้วย้าย:

```bash
npx create-next-app@15 _scaffold --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --no-turbopack --skip-install
```

ย้ายทุกอย่างใน `_scaffold` (ยกเว้น `.git`) มาที่ราก ทับ `package.json` เดิม ลบ `_scaffold` แล้วรวม `.gitignore` เดิมเข้ากับของใหม่ และเพิ่ม `test-results/`, `playwright-report/`, `Data/*.pdf` (ไฟล์ใน `Data/extracted/` ให้ commit ตามปกติ)

- [ ] **Step 2: ติดตั้ง dependency**

```bash
npm install @prisma/client next-auth@beta bcryptjs zod exceljs recharts
npm install -D prisma tsx vitest @playwright/test pdfjs-dist@4.10.38 @types/bcryptjs
npx shadcn@latest init -d
npx shadcn@latest add button input label select table card dialog badge textarea
```

- [ ] **Step 3: `docker-compose.yml` และ `.env`**

Service เดียว `db`: `postgres:16`, พอร์ต `5432:5432`, volume ชื่อ `pgdata`, env `POSTGRES_USER=courses`, `POSTGRES_PASSWORD=courses`, `POSTGRES_DB=courses` และ mount `docker/init.sql` ที่มี `CREATE DATABASE courses_test;` ไปที่ `/docker-entrypoint-initdb.d/`

`.env.example` (และคัดลอกเป็น `.env`):

```
DATABASE_URL="postgresql://courses:courses@localhost:5432/courses"
TEST_DATABASE_URL="postgresql://courses:courses@localhost:5432/courses_test"
AUTH_SECRET="เปลี่ยนค่านี้: openssl rand -base64 32"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="เปลี่ยนรหัสผ่านนี้"
```

- [ ] **Step 4: `prisma/schema.prisma`**

```prisma
enum Role { ADMIN STAFF }

model Category {
  id         Int        @id @default(autoincrement())
  code       String     @unique          // "PRE", "1", "1.1", "2.2", "3", "4"
  name       String
  minCredits Int?
  note       String?
  sortOrder  Int        @default(0)
  parentId   Int?
  parent     Category?  @relation("Tree", fields: [parentId], references: [id], onDelete: Restrict)
  children   Category[] @relation("Tree")
  courses    Course[]
}

model Course {
  id              Int       @id @default(autoincrement())
  code            String    @unique
  nameTh          String
  nameEn          String    @default("")
  theoryHours     Int
  practiceHours   Int
  credits         Int
  standardRef     String?
  learningOutcome String?
  objectives      String?
  competencies    String?
  description     String?
  categoryId      Int
  category        Category  @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  sourcePage      Int?
  needsReview     Boolean   @default(false)
  reviewNote      String?
  editedAt        DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([code(ops: raw("gin_trgm_ops"))], type: Gin)
  @@index([nameTh(ops: raw("gin_trgm_ops"))], type: Gin)
  @@index([nameEn(ops: raw("gin_trgm_ops"))], type: Gin)
}

model User {
  id           Int      @id @default(autoincrement())
  email        String   @unique
  name         String
  passwordHash String
  role         Role     @default(STAFF)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 5: สร้าง migration**

```bash
docker compose up -d
npx prisma migrate dev --name init --create-only
```

เพิ่ม `CREATE EXTENSION IF NOT EXISTS pg_trgm;` เป็นบรรทัดแรกของไฟล์ migration ที่สร้างขึ้น แล้วรัน `npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.`

- [ ] **Step 6: `lib/db.ts`, `vitest.config.ts`, `tests/db/setup.ts`**

- `lib/db.ts`: singleton มาตรฐานของ Prisma สำหรับ Next.js (เก็บใน `globalThis` เมื่อไม่ใช่ production)
- `vitest.config.ts`: alias `@` → ราก; สอง project: `unit` (`tests/unit/**`) และ `db` (`tests/db/**`, `fileParallelism: false`, `setupFiles: tests/db/setup.ts`, `globalSetup` ที่ตั้ง `DATABASE_URL = TEST_DATABASE_URL` แล้วรัน `prisma migrate deploy`)
- `tests/db/setup.ts`: `beforeEach` → `TRUNCATE "Course","Category","User" RESTART IDENTITY CASCADE`
- `package.json` scripts: `"test": "vitest run --project unit"`, `"test:db": "vitest run --project db"`, `"extract": "tsx scripts/pdf/extract.ts"`, และ `"prisma": {"seed": "tsx prisma/seed.ts"}`

- [ ] **Step 7: เขียนการทดสอบ schema**

`tests/db/schema.test.ts`:

```ts
test("รหัสวิชาซ้ำไม่ได้", async () => {
  const cat = await db.category.create({ data: { code: "1", name: "หมวด" } });
  const data = { code: "31900-0001", nameTh: "ก", theoryHours: 1, practiceHours: 4, credits: 3, categoryId: cat.id };
  await db.course.create({ data });
  await expect(db.course.create({ data })).rejects.toMatchObject({ code: "P2002" });
});
test("ลบหมวดที่มีรายวิชาไม่ได้", async () => {
  const cat = await db.category.create({ data: { code: "1", name: "หมวด" } });
  await db.course.create({ data: { code: "X", nameTh: "ก", theoryHours: 0, practiceHours: 0, credits: 0, categoryId: cat.id } });
  await expect(db.category.delete({ where: { id: cat.id } })).rejects.toMatchObject({ code: "P2003" });
});
test("มี extension pg_trgm", async () => {
  const rows = await db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM pg_extension WHERE extname='pg_trgm'`;
  expect(Number(rows[0].n)).toBe(1);
});
```

- [ ] **Step 8: รัน**

Run: `npm run test:db` → Expected: 3 passed
Run: `npm run build` → Expected: build สำเร็จ

- [ ] **Step 9: Commit** — `git add -A . ':!Data/*.pdf'` แล้ว commit `chore: scaffold Next.js app, Postgres and Prisma schema`

---

### Task 2: `normalizeThai`

**Files:**
- Create: `lib/normalize-thai.ts`
- Test: `tests/unit/normalize-thai.test.ts`

**Interfaces:**
- Produces: `normalizeThai(s: string): string` และ `foldThai(s: string): string` (ใช้เทียบหัวข้อที่ "า" เพี้ยนเป็น "ำ": แปลง `ำ`→`า` แล้วลบช่องว่างทั้งหมด)

- [ ] **Step 1: เขียนการทดสอบ**

```ts
test.each([
  ["ใช", "ใช้"],                    // PUA วรรณยุกต์ตำแหน่งต่ำ
  ["กลุม", "กลุ่ม"],
  ["ซอฟตแวร", "ซอฟต์แวร์"],
  ["เปน", "เป็น"],
  ["คําสั่ง", "คำสั่ง"],                    // นิคหิต + สระอา → สระอำ
  ["ค ำนำ", "คำนำ"],                       // ช่องว่างก่อนสระอำ
])("%s → %s", (input, want) => expect(normalizeThai(input)).toBe(want));

// สระอำที่หายจนเหลือ "ช่องว่าง + า" เดาคืนไม่ได้ ต้องคงไว้ตามเดิมให้คนแก้
test("ไม่เดาสระอำที่หายไป", () => expect(normalizeThai("ส านักงาน")).toBe("ส านักงาน"));

test("ลบสัญลักษณ์ PUA ของฟอนต์สัญลักษณ์", () => expect(normalizeThai(" หลักการ")).toBe("หลักการ"));
test("ยุบช่องว่างซ้ำและตัดหัวท้าย", () => expect(normalizeThai("  ก   ข ")).toBe("ก ข"));
test("ช่องว่างก่อนสระ/วรรณยุกต์บนล่างถูกลบ", () => expect(normalizeThai("ชั้ นสูง")).toBe("ชั้นสูง"));
test("ไม่แตะข้อความอังกฤษและตัวเลข", () => expect(normalizeThai("Website Development 1-4-3")).toBe("Website Development 1-4-3"));
test("foldThai", () => expect(foldThai("ค ำอธิบำยรำยวิชำ")).toBe("คาอธิบายรายวิชา"));
```

- [ ] **Step 2: รันให้เห็นว่าล้ม** — `npm test` → FAIL (ไม่มีโมดูล)

- [ ] **Step 3: เขียน `normalizeThai`**

ลำดับขั้นตายตัว:

1. แปลง PUA ตามตารางนี้ (ชุดอักขระไทยส่วนขยายของ Windows):

| ช่วง | แทนด้วย |
|---|---|
| U+F700 | ฐ |
| U+F701–F704 | ิ ี ึ ื |
| U+F705–F709, U+F70A–F70E, U+F713–F717 | ่ ้ ๊ ๋ ์ (ตามลำดับในแต่ละช่วง) |
| U+F70F | ญ |
| U+F710, F711, F712 | ั ํ ็ |

2. ลบอักขระ PUA ที่เหลือทั้งหมด (U+E000–F8FF)
3. `ํ` + `า` → `ำ`
4. ลบช่องว่างที่อยู่หน้า `ำ` หรือหน้าอักขระ U+0E31, U+0E34–0E3A, U+0E47–0E4E เมื่อตัวก่อนช่องว่างเป็นอักขระไทย
5. ยุบช่องว่างต่อเนื่องเป็นหนึ่ง แล้ว trim

- [ ] **Step 4: รันให้ผ่าน** — `npm test` → PASS
- [ ] **Step 5: Commit** — `feat: add Thai text normalization`

---

### Task 3: ตัวแยกข้อมูลจาก PDF (ฟังก์ชันล้วน)

**Files:**
- Create: `scripts/pdf/lines.ts`, `scripts/pdf/parse.ts`
- Test: `tests/unit/pdf-lines.test.ts`, `tests/unit/pdf-parse.test.ts`

**Interfaces:**
- Consumes: `normalizeThai`, `foldThai`
- Produces:

```ts
// lines.ts
type Item = { str: string; x: number; y: number; width: number };
type Cell = { x: number; text: string };
type Line = { page: number; y: number; cells: Cell[]; text: string };
function buildLines(page: number, items: Item[]): Line[];

// parse.ts
type CourseRow = { code: string; nameTh: string; theoryHours: number; practiceHours: number; credits: number };
type ExtractedCategory = { code: string; name: string; minCredits: number | null; parentCode: string | null; sortOrder: number };
type ExtractedCourse = CourseRow & {
  nameEn: string; categoryCode: string | null;
  standardRef: string | null; learningOutcome: string | null; objectives: string | null;
  competencies: string | null; description: string | null;
  sourcePage: number | null; needsReview: boolean; reviewReasons: string[];
};
type Extracted = { categories: ExtractedCategory[]; courses: ExtractedCourse[] };
function parseCourseRow(line: Line): CourseRow | null;
function parseCategoryHeading(line: Line): { code: string; name: string; minCredits: number | null } | null;
function parseDocument(lines: Line[]): Extracted;
```

- [ ] **Step 1: การทดสอบ `buildLines`**

```ts
test("รวม item ที่ baseline ต่างกันไม่เกิน 4pt เป็นบรรทัดเดียว เรียงตาม x", () => {
  const lines = buildLines(94, [
    { str: "กิจกรรมองค์การวิชาชีพ 1", x: 200, y: 528, width: 120 },
    { str: "30000", x: 95, y: 525, width: 28 }, { str: "-", x: 124, y: 525, width: 3 },
    { str: "20", x: 127, y: 525, width: 11 }, { str: "02", x: 139, y: 525, width: 11 },
    { str: "0", x: 498, y: 525, width: 5 }, { str: "-", x: 504, y: 525, width: 3 }, { str: "2", x: 507, y: 525, width: 5 },
    { str: "-", x: 513, y: 525, width: 3 }, { str: "0", x: 516, y: 525, width: 5 },
  ]);
  expect(lines).toHaveLength(1);
  expect(lines[0].cells.map((c) => c.text)).toEqual(["30000-2002", "กิจกรรมองค์การวิชาชีพ 1", "0-2-0"]);
});
test("item ที่ห่างกันน้อยกว่า 2pt ต่อกันไม่เว้นวรรค ห่างกว่านั้นเป็น cell ใหม่", () => {
  const [l] = buildLines(1, [
    { str: "I", x: 151, y: 700, width: 3 }, { str: "nformation technology", x: 154, y: 700, width: 110 },
    { str: "Projects", x: 276, y: 700, width: 40 },
  ]);
  expect(l.cells.map((c) => c.text)).toEqual(["Information technology", "Projects"]);
  expect(l.text).toBe("Information technology Projects");
});
test("ตัดหัวกระดาษ (y > 780) และท้ายกระดาษ (y < 80) และ item ว่าง", () => {
  expect(buildLines(1, [
    { str: "47", x: 513, y: 786, width: 10 }, { str: " ", x: 100, y: 500, width: 3 },
    { str: "หลักสูตร…", x: 113, y: 66, width: 300 }, { str: "เนื้อหา", x: 72, y: 500, width: 40 },
  ]).map((l) => l.text)).toEqual(["เนื้อหา"]);
});
```

- [ ] **Step 2: เขียน `buildLines`**

เรียง item ตาม y มากไปน้อย จัดกลุ่มกับบรรทัดปัจจุบันถ้า `|y - yของ item แรกในบรรทัด| ≤ 4`; ในบรรทัดเรียงตาม x; item ถัดไปต่อเข้า cell เดิมถ้า `x - (xก่อนหน้า + widthก่อนหน้า) < 2` มิฉะนั้นเปิด cell ใหม่; `cell.text` ผ่าน `normalizeThai`; `line.text` = cell ต่อกันด้วยช่องว่างเดียว; `line.y` = y ของ item แรก

- [ ] **Step 3: การทดสอบ `parseCourseRow` และ `parseCategoryHeading`**

ใช้ helper `line(...cells: [number, string][]): Line`

```ts
test("แถวปกติ", () => expect(parseCourseRow(line([100, "31900-0001"], [171, "การสร้างเว็บไซต์"], [498, "1-4-3"])))
  .toEqual({ code: "31900-0001", nameTh: "การสร้างเว็บไซต์", theoryHours: 1, practiceHours: 4, credits: 3 }));
test("รหัสถูกหั่นหลาย cell", () => expect(parseCourseRow(line([100, "319"], [118, "00"], [129, "-"], [133, "0"], [139, "00"], [150, "4"], [171, "ระบบเครือข่ายคอมพิวเตอร์"], [498, "1"], [504, "-"], [507, "4"], [513, "-"], [516, "3"]))?.code)
  .toBe("31900-0004"));
test("ชื่อลงท้ายด้วยตัวเลขไม่ถูกกลืนเป็นชั่วโมง", () => expect(parseCourseRow(line([95, "30000-2002"], [200, "กิจกรรมองค์การวิชาชีพ 1"], [498, "0-2"], [513, "-"], [516, "0"])))
  .toMatchObject({ nameTh: "กิจกรรมองค์การวิชาชีพ 1", theoryHours: 0, practiceHours: 2, credits: 0 }));
test("ขีดกลางแบบ en dash", () => expect(parseCourseRow(line([100, "31900-1001"], [171, "กฎหมาย"], [495, "1"], [501, "–"], [507, "0"], [513, "-"], [516, "1"]))?.credits).toBe(1));
test("ชั่วโมงสองหลัก", () => expect(parseCourseRow(line([72, "31901-2015"], [150, "โครงงาน"], [492, "0-12-4"])))
  .toMatchObject({ practiceHours: 12, credits: 4 }));
test("ไม่ใช่แถวรายวิชา", () => {
  expect(parseCourseRow(line([104, "รหัสวิชา"], [207, "ชื่อวิชา"], [495, "ท-ป-น"]))).toBeNull();
  expect(parseCourseRow(line([171, "Website Development"]))).toBeNull();
  expect(parseCourseRow(line([100, "31900-0001"], [171, "ไม่มีชั่วโมง"]))).toBeNull();
});
test("หัวข้อหมวด/กลุ่ม", () => {
  expect(parseCategoryHeading(line([90, "1."], [108, "หมวดวิชาสมรรถนะแกนกลาง"], [396, "ไม่น้อยกว่า"], [456, "15"], [477, "หน่วยกิต"])))
    .toEqual({ code: "1", name: "หมวดวิชาสมรรถนะแกนกลาง", minCredits: 15 });
  expect(parseCategoryHeading(line([90, "2.1"], [108, "กลุ่มสมรรถนะวิชาชีพพื้นฐาน"], [238, "(15"], [258, "หน่วยกิต"], [297, ")"])))
    .toEqual({ code: "2.1", name: "กลุ่มสมรรถนะวิชาชีพพื้นฐาน", minCredits: 15 });
  expect(parseCategoryHeading(line([90, "2."], [108, "หมวดวิชาสมรรถนะวิชาชีพ"], [396, "ไม่น้อยกว่า"], [456, "6"], [462, "0"], [477, "หน่วยกิต"])))
    .toMatchObject({ minCredits: 60 });
  expect(parseCategoryHeading(line([72, "4."], [90, "กิจกรรมเสริมหลักสูตร"], [201, "(2 ชั่วโมงต่อสัปดาห์)"])))
    .toEqual({ code: "4", name: "กิจกรรมเสริมหลักสูตร", minCredits: null });
  expect(parseCategoryHeading(line([108, "1. เข้าใจหลักการเขียนแผนธุรกิจ"]))).toBeNull();
});
```

- [ ] **Step 4: เขียนสองฟังก์ชัน**

`parseCourseRow`:
1. เดินจาก cell ซ้ายสุด สะสมข้อความ (ลบช่องว่าง, แปลง `–` เป็น `-`) ตราบที่ cell มีเฉพาะตัวเลข/ขีด/ช่องว่าง จนกว่าจะตรง `^\d{5}-\d{4}$`; ถ้าไม่ตรง → `null`
2. cell ที่เหลือซึ่ง `x ≥ 460` รวมกัน (ลบช่องว่าง, แปลง `–`) ต้องตรง `^(\d{1,2})-(\d{1,2})-(\d{1,2})$`; ถ้าไม่ตรง → `null`
3. cell ที่เหลือซึ่ง `x < 460` ต่อด้วยช่องว่าง = `nameTh` (ต้องไม่ว่าง)

`parseCategoryHeading`: cell แรกต้องตรง `^\d(\.\d)*\.?$` และ cell ที่สองขึ้นต้นด้วย `หมวด`, `กลุ่ม` หรือ `กิจกรรมเสริมหลักสูตร`; `code` = ตัวเลขตัดจุดท้าย; `name` = cell ที่สอง; `minCredits` = ตัวเลขในข้อความส่วนที่เหลือ (ลบช่องว่างก่อน) ที่อยู่หน้าคำว่า `หน่วยกิต` ถ้าไม่มี → `null`

- [ ] **Step 5: การทดสอบ `parseDocument`**

สร้าง `tests/fixtures/pdf-lines.ts` เป็น `Line[]` ย่อที่ประกอบด้วย: หัวข้อ `1.` และ `1.1`, แถวตาราง 2 วิชา + บรรทัดชื่ออังกฤษ, แถววิชาซ้ำของวิชาแรกในตารางที่สอง, บล็อกคำอธิบายของวิชาแรกครบห้าหัวข้อโดยหัวข้อเขียนแบบเพี้ยน (`อ้ำงอิงมำตรฐำน`, `ผลลัพธ์กำรเรียนรู้ระดับรำยวิชำ`, `จุดประสงค์รำยวิชำ เพื่อให้`, `สมรรถนะรำยวิชำ`, `คำอธิบำยรำยวิชำ`) และมีเนื้อหาข้ามหน้า, และบรรทัด `รายวิชาปรับพื้นฐานวิชาชีพ` นำหน้าแถวอีกหนึ่งวิชา

```ts
const out = parseDocument(fixtureLines);
test("วิชาซ้ำนับครั้งเดียว", () => expect(out.courses.map((c) => c.code)).toEqual(["30000-1101", "30000-1102", "31900-0001"]));
test("ผูกหมวดจากหัวข้อล่าสุด และหมวดปรับพื้นฐานใช้รหัส PRE", () => {
  expect(out.courses[0].categoryCode).toBe("1.1");
  expect(out.courses[2].categoryCode).toBe("PRE");
  expect(out.categories.find((c) => c.code === "1.1")).toMatchObject({ parentCode: "1", minCredits: 6 });
});
test("ชื่ออังกฤษมาจากบรรทัดถัดจากแถว", () => expect(out.courses[0].nameEn).toBe("Thai Language Skills for Career Communication"));
test("ชื่อไทยใช้จากตาราง ไม่ใช่จากหัวบล็อกคำอธิบายที่เพี้ยน", () => expect(out.courses[0].nameTh).not.toContain("กำร"));
test("แบ่งห้าหัวข้อ เนื้อหาข้ามหน้าต่อกัน คงการขึ้นบรรทัดของเลขข้อ", () => {
  const c = out.courses[0];
  expect(c.standardRef).toBe("-");
  expect(c.objectives).toMatch(/^1\. .+\n2\. /);
  expect(c.objectives).not.toContain("เพื่อให้");
  expect(c.description).toContain("ศึกษาและปฏิบัติ");
  expect(c.sourcePage).toBe(61);
  expect(c.needsReview).toBe(false);
});
test("วิชาที่ไม่มีคำอธิบายถูกตั้ง needsReview พร้อมเหตุผล", () =>
  expect(out.courses[1]).toMatchObject({ needsReview: true, reviewReasons: ["ไม่พบคำอธิบายรายวิชา"] }));
```

- [ ] **Step 6: เขียน `parseDocument`**

เดินบรรทัดตามลำดับหน้าและ y ด้วย state `currentCategory` และ `currentBlock`:

- `parseCategoryHeading` สำเร็จ → บันทึกหมวด (ครั้งแรกที่เจอรหัสนั้นเท่านั้น; ถ้าครั้งหลังมี `minCredits` แต่ครั้งแรกไม่มี ให้เติม), `parentCode` = รหัสตัดส่วนท้ายสุด, `sortOrder` = ลำดับที่เจอ; ตั้ง `currentCategory`
- `foldThai(text)` ขึ้นต้นด้วย `รายวิชาปรับพื้นฐานวิชาชีพ` หรือลงท้ายด้วย `ปรับพื้นฐานวิชาชีพจำนวน15หน่วยกิตต่อไปนี้` → หมวด `PRE` ชื่อ `รายวิชาปรับพื้นฐานวิชาชีพ`, `minCredits` 15
- `parseCourseRow` สำเร็จ:
  - ถ้าภายใน 3 บรรทัดถัดไปมีบรรทัดที่ `foldThai` เท่ากับ `อ้างอิงมาตรฐาน` → เปิดบล็อกคำอธิบายของรหัสนั้น (`sourcePage` = หน้านี้) ไม่ใช้ชื่อจากแถวนี้
  - มิฉะนั้นเป็นแถวตาราง: ถ้ายังไม่เคยเจอรหัส สร้างวิชาด้วย `categoryCode = currentCategory`; บรรทัดถัดไปที่เป็น ASCII ล้วนและ `cells[0].x` ต่างจาก x ของ cell ชื่อไม่เกิน 5 = `nameEn`
- ภายในบล็อก: บรรทัดที่ `foldThai` ขึ้นต้นด้วยหัวข้อใดหัวข้อหนึ่ง (`อ้างอิงมาตรฐาน`, `ผลลัพธ์การเรียนรู้ระดับรายวิชา`, `จุดประสงค์รายวิชา`, `สมรรถนะรายวิชา`, `คาอธิบายรายวิชา`) สลับหัวข้อปัจจุบัน; บรรทัดอื่นต่อเข้าหัวข้อปัจจุบัน — ขึ้นบรรทัดใหม่ถ้าบรรทัดขึ้นต้นด้วย `^\d+\s*\.` มิฉะนั้นต่อด้วยช่องว่าง (ไม่เว้นถ้าทั้งสองฝั่งเป็นอักขระไทย); บล็อกจบเมื่อเปิดบล็อกใหม่ หรือเจอ `parseCategoryHeading` หรือบรรทัดที่ `foldThai` เท่ากับ `คาอธิบายรายวิชา` ขณะหัวข้อปัจจุบันคือคำอธิบายอยู่แล้ว (หน้าคั่นหมวด)
- ปิดท้าย: วิชาที่บล็อกอ้างถึงแต่ไม่อยู่ในตาราง → สร้างด้วยชื่อจากหัวบล็อก, `categoryCode: null`, เหตุผล `ไม่พบในตารางโครงสร้าง`; ไม่มีบล็อก → `ไม่พบคำอธิบายรายวิชา`; ท-ป-น ตารางกับบล็อกไม่ตรง → `ท-ป-น ไม่ตรงกัน (ตาราง a-b-c, คำอธิบาย x-y-z)`; หัวข้อใดว่าง → `ขาดหัวข้อ: <ชื่อหัวข้อ>`; `needsReview` = มีเหตุผลอย่างน้อยหนึ่งข้อ

- [ ] **Step 7: รันให้ผ่าน** — `npm test` → PASS
- [ ] **Step 8: Commit** — `feat: add PDF line builder and course parser`

---

### Task 4: รัน extract กับ PDF จริง และ seed

**Files:**
- Create: `scripts/pdf/extract.ts`, `prisma/seed.ts`, `lib/seed-data.ts`, `Data/extracted/courses.json`, `Data/extracted/report.txt`
- Delete: `scripts/inspect-pdf.mjs`, `scripts/scan-pdf-quality.mjs` (หมดหน้าที่แล้ว)
- Test: `tests/db/seed.test.ts`

**Interfaces:**
- Consumes: `buildLines`, `parseDocument`, `Extracted`
- Produces: `seedFromExtracted(db, data: Extracted, opts?: { force?: boolean }): Promise<{ created: number; updated: number; skipped: number }>` และ `ensureAdmin(db, email: string, password: string): Promise<void>` ใน `lib/seed-data.ts`

- [ ] **Step 1: `scripts/pdf/extract.ts`**

อ่าน `Data/31901v7_18_10_68.pdf` ด้วย `pdfjs-dist/legacy/build/pdf.mjs` (ตั้ง `cMapUrl`, `standardFontDataUrl` ไปที่โฟลเดอร์ใน `node_modules/pdfjs-dist` แบบเดียวกับ `scripts/inspect-pdf.mjs` เดิม) หน้า 37–106; แต่ละ item → `{ str, x: transform[4], y: transform[5], width }`; `buildLines` → `parseDocument`; เขียน `Data/extracted/courses.json` (indent 1) และ `report.txt` ที่มี: จำนวนหมวด, จำนวนวิชารวมและต่อหมวด, รายการวิชา `needsReview` พร้อมเหตุผล; พิมพ์สรุปเดียวกันออกจอ; exit code 1 ถ้าได้ 0 วิชา

- [ ] **Step 2: รันกับ PDF จริง**

Run: `npm run extract`
Expected: ได้วิชามากกว่า 100 รายการ ทุกหมวดในข้อ 2 ของ spec ปรากฏ (`PRE`, `1`, `1.1`–`1.3`, `2`, `2.1`, `2.2`, `3`, `4`)

- [ ] **Step 3: จุดตรวจโดยคน — หยุดรายงานผู้ใช้**

เปิด `report.txt` แล้วสุ่มเทียบ 10 วิชาใน `courses.json` กับ PDF (รวมอย่างน้อยหนึ่งวิชาจากหน้า 45–47, 94, 106 ที่เคยมี PUA) ถ้าสัดส่วน `needsReview` เกิน 10% หรือพบรูปแบบผิดซ้ำ ๆ ให้เพิ่ม fixture ที่จำลองกรณีนั้นใน Task 3 แก้ parser แล้วรันใหม่ ก่อนไปต่อ รายงานจำนวนวิชา จำนวนที่ต้องตรวจ และตัวอย่างให้ผู้ใช้ทราบ

- [ ] **Step 4: การทดสอบ seed**

```ts
const data: Extracted = { categories: [{ code: "1", name: "หมวด", minCredits: 15, parentCode: null, sortOrder: 0 }, { code: "1.1", name: "กลุ่ม", minCredits: 6, parentCode: "1", sortOrder: 1 }],
  courses: [course("30000-1101", "1.1"), course("X-0001", null)] };
test("สร้างหมวดเป็นต้นไม้และรายวิชา; วิชาไม่มีหมวดไปอยู่หมวด 'ยังไม่จัดหมวด' (รหัส NONE) และ needsReview", async () => {
  expect(await seedFromExtracted(db, data)).toEqual({ created: 2, updated: 0, skipped: 0 });
  const sub = await db.category.findUniqueOrThrow({ where: { code: "1.1" }, include: { parent: true } });
  expect(sub.parent?.code).toBe("1");
  const orphan = await db.course.findUniqueOrThrow({ where: { code: "X-0001" }, include: { category: true } });
  expect(orphan.category.code).toBe("NONE"); expect(orphan.needsReview).toBe(true);
});
test("รันซ้ำไม่เพิ่มแถว", async () => {
  await seedFromExtracted(db, data); await seedFromExtracted(db, data);
  expect(await db.course.count()).toBe(2); expect(await db.category.count()).toBe(3);
});
test("ไม่ทับวิชาที่แก้ผ่านเว็บ เว้นแต่ force", async () => {
  await seedFromExtracted(db, data);
  await db.course.update({ where: { code: "30000-1101" }, data: { nameTh: "แก้แล้ว", editedAt: new Date() } });
  expect(await seedFromExtracted(db, data)).toMatchObject({ skipped: 1 });
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).nameTh).toBe("แก้แล้ว");
  await seedFromExtracted(db, data, { force: true });
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).nameTh).not.toBe("แก้แล้ว");
});
test("ensureAdmin สร้าง ADMIN ครั้งเดียวและไม่เปลี่ยนรหัสผ่านของบัญชีที่มีอยู่", async () => {
  await ensureAdmin(db, "a@x.th", "secret-1"); await ensureAdmin(db, "a@x.th", "secret-2");
  const u = await db.user.findMany(); expect(u).toHaveLength(1); expect(u[0].role).toBe("ADMIN");
  expect(await bcrypt.compare("secret-1", u[0].passwordHash)).toBe(true);
});
```

- [ ] **Step 5: เขียน `lib/seed-data.ts` และ `prisma/seed.ts`**

`reviewNote` = `reviewReasons.join("; ")`; `prisma/seed.ts` อ่าน `Data/extracted/courses.json`, เรียกสองฟังก์ชัน (`force` เมื่อมี `--force` ใน argv), พิมพ์ผลนับ; ล้มพร้อมข้อความชัดเจนถ้าไม่มี `ADMIN_EMAIL`/`ADMIN_PASSWORD` หรือรหัสผ่านสั้นกว่า 8 ตัว

- [ ] **Step 6: รัน** — `npm run test:db` → PASS; `npx prisma db seed` → พิมพ์จำนวน created เท่ากับจำนวนวิชาใน report
- [ ] **Step 7: Commit** — รวม `Data/extracted/*` — `feat: extract courses from PDF and seed database`

---

### Task 5: `lib/courses.ts` — ค้นหา กรอง สถิติ

**Files:**
- Create: `lib/courses.ts`
- Test: `tests/db/courses.test.ts`, `tests/unit/search-params.test.ts`

**Interfaces:**
- Consumes: `db`, `normalizeThai`
- Produces:

```ts
const PAGE_SIZE = 20;
type CourseFilter = { q: string; categoryId: number | null; credits: number | null; page: number };
type CourseListItem = { id: number; code: string; nameTh: string; nameEn: string; theoryHours: number; practiceHours: number; credits: number; categoryName: string; needsReview: boolean };
type CategoryNode = { id: number; code: string; name: string; minCredits: number | null; depth: number; courseCount: number };  // courseCount รวมหมวดย่อย
function parseFilter(sp: Record<string, string | string[] | undefined>): CourseFilter;
function filterToQuery(f: Partial<CourseFilter>): string;            // "" หรือ "?q=…&page=2" ไม่ใส่ค่า default
function searchCourses(f: CourseFilter): Promise<{ items: CourseListItem[]; total: number; page: number; pageCount: number }>;
function allMatchingCourses(f: CourseFilter): Promise<CourseListItem[]>;   // ไม่แบ่งหน้า สำหรับ export/print
function getCourseByCode(code: string): Promise<(Course & { path: { code: string; name: string }[] }) | null>;
function listCategories(): Promise<CategoryNode[]>;                   // เรียงแบบ depth-first ตาม sortOrder
function getStats(): Promise<{ totalCourses: number; byCategory: { code: string; name: string; depth: number; courses: number; credits: number; minCredits: number | null }[]; byCredits: { credits: number; courses: number }[]; hours: { theory: number; practice: number } }>;
```

- [ ] **Step 1: การทดสอบ `parseFilter` / `filterToQuery`** (unit)

```ts
test("ค่าเริ่มต้น", () => expect(parseFilter({})).toEqual({ q: "", categoryId: null, credits: null, page: 1 }));
test("q ถูก normalize และ trim; ช่องว่างล้วนเป็นค่าว่าง", () => {
  expect(parseFilter({ q: "  คําสั่ง " }).q).toBe("คำสั่ง");
  expect(parseFilter({ q: "   " }).q).toBe("");
});
test("q ยาวเกิน 100 ตัวถูกตัด", () => expect(parseFilter({ q: "ก".repeat(300) }).q).toHaveLength(100));
test.each([["abc", 1], ["-3", 1], ["0", 1], ["2.7", 1], ["3", 3]])("page=%s → %i", (v, want) => expect(parseFilter({ page: v }).page).toBe(want));
test("category/credits ที่ไม่ใช่จำนวนเต็มไม่ติดลบถูกเพิกเฉย", () => expect(parseFilter({ category: "x", credits: "-1" })).toMatchObject({ categoryId: null, credits: null }));
test("ค่าเป็น array ใช้ตัวแรก", () => expect(parseFilter({ q: ["a", "b"] }).q).toBe("a"));
test("filterToQuery ละค่า default", () => {
  expect(filterToQuery({ q: "", page: 1 })).toBe("");
  expect(filterToQuery({ q: "เว็บ", categoryId: 3, page: 2 })).toBe("?q=%E0%B9%80%E0%B8%A7%E0%B9%87%E0%B8%9A&category=3&page=2");
});
```

- [ ] **Step 2: การทดสอบกับฐานข้อมูล**

`beforeEach` สร้าง: หมวด `1` > `1.1`, หมวด `2`; 25 วิชาใน `1.1` (รหัส `30000-1101`…, 2 หน่วยกิต), 1 วิชาใน `2` รหัส `31900-0001` ชื่อ `การสร้างเว็บไซต์` / `Website Development` 3 หน่วยกิต ท-ป 1-4 คำอธิบายมีคำว่า `HTML`, และ 1 วิชาชื่อ `100% ออนไลน์_ทดสอบ`

```ts
test("แบ่งหน้า 20 และเรียงตามรหัส", async () => { const r = await searchCourses(f({})); expect(r.items).toHaveLength(20); expect(r.total).toBe(27); expect(r.pageCount).toBe(2); expect(r.items[0].code < r.items[1].code).toBe(true); });
test("page เกินหน้าสุดท้ายถูกบีบ", async () => { const r = await searchCourses(f({ page: 99 })); expect(r.page).toBe(2); expect(r.items).toHaveLength(7); });
test.each([["31900", 1], ["เว็บไซต์", 1], ["website", 1], ["html", 1], ["ไม่มีแน่นอน", 0]])("ค้น %s", async (q, n) => expect((await searchCourses(f({ q }))).total).toBe(n));
test("% และ _ เป็นตัวอักษรธรรมดา", async () => {
  expect((await searchCourses(f({ q: "%" }))).total).toBe(1);
  expect((await searchCourses(f({ q: "_" }))).total).toBe(1);
  expect((await searchCourses(f({ q: "\\" }))).total).toBe(0);
});
test("กรองหมวดรวมหมวดย่อย", async () => expect((await searchCourses(f({ categoryId: cat1.id }))).total).toBe(25));
test("หมวดที่ไม่มีจริงให้ผลว่าง ไม่ล้ม", async () => expect((await searchCourses(f({ categoryId: 999999 }))).total).toBe(0));
test("กรองหน่วยกิตร่วมกับคำค้น", async () => expect((await searchCourses(f({ q: "เว็บ", credits: 3 }))).total).toBe(1));
test("allMatchingCourses ไม่แบ่งหน้า", async () => expect(await allMatchingCourses(f({}))).toHaveLength(27));
test("getCourseByCode: ตรงตัว, trim, ไม่พบ → null, มีเส้นทางหมวด", async () => {
  expect((await getCourseByCode(" 30000-1101 "))?.path.map((p) => p.code)).toEqual(["1", "1.1"]);
  expect(await getCourseByCode("../etc")).toBeNull();
});
test("listCategories นับรวมหมวดย่อย", async () => expect((await listCategories()).map((c) => [c.code, c.depth, c.courseCount])).toEqual([["1", 0, 25], ["1.1", 1, 25], ["2", 0, 2]]));
test("getStats", async () => { const s = await getStats(); expect(s.totalCourses).toBe(27); expect(s.byCategory.find((c) => c.code === "1")).toMatchObject({ courses: 25, credits: 50 }); expect(s.byCredits).toContainEqual({ credits: 2, courses: 25 }); });
```

- [ ] **Step 3: เขียน `lib/courses.ts`**

ค้นด้วย Prisma `OR` ของ `contains` + `mode: "insensitive"` บน `code`, `nameTh`, `nameEn`, `description`; ถ้าการทดสอบ `%`/`_` ล้ม ให้ escape `\`, `%`, `_` ใน `q` ก่อนส่ง; หมวดย่อยหาจากการโหลดหมวดทั้งหมด (จำนวนน้อย) แล้วไล่ในหน่วยความจำ; สถิติรวมค่าลูกขึ้นแม่

- [ ] **Step 4: รันให้ผ่าน** — `npm test && npm run test:db`
- [ ] **Step 5: Commit** — `feat: add course search, filtering and stats`

---

### Task 6: หน้าสาธารณะ — รายการ รายละเอียด พิมพ์

**Files:**
- Create: `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `app/(public)/courses/[code]/page.tsx`, `app/(public)/print/page.tsx`, `app/not-found.tsx`, `app/error.tsx`, `components/course-filters.tsx`, `components/course-table.tsx`, `components/pagination.tsx`, `components/print-button.tsx`
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/fixtures/courses.sample.json`, `tests/e2e/public.spec.ts`

**Interfaces:**
- Consumes: ทุกฟังก์ชันจาก Task 5; `seedFromExtracted`, `ensureAdmin`
- Produces: โครง Playwright ที่ Task 7–11 ใช้ต่อ: เซิร์ฟเวอร์ทดสอบที่ `http://localhost:3100` บนฐาน `courses_test`, ผู้ใช้ `admin@test.local` / `staff@test.local` รหัสผ่าน `password-1234`

- [ ] **Step 1: โครง Playwright**

- `tests/fixtures/courses.sample.json`: รูปแบบ `Extracted` มีหมวด `1` > `1.1`, `2` > `2.1` และ 45 วิชา (ให้เกิน 2 หน้า) รวม `31900-0001 การสร้างเว็บไซต์ / Website Development` ที่มีครบห้าหัวข้อ และหนึ่งวิชา `needsReview`
- `tests/e2e/global-setup.ts`: ตั้ง `DATABASE_URL = TEST_DATABASE_URL`, `prisma migrate deploy`, truncate, seed จาก fixture, สร้างผู้ใช้สองคนข้างต้น (STAFF สร้างด้วย `db.user.create`)
- `playwright.config.ts`: `webServer` = `npm run build && npm run start -- -p 3100` พร้อม env `DATABASE_URL=TEST_DATABASE_URL`, `AUTH_SECRET=test-secret`, `AUTH_TRUST_HOST=true`; `workers: 1`; สคริปต์ npm `"test:e2e": "playwright test"`

- [ ] **Step 2: เขียน E2E**

```ts
test("ค้นหา กรอง แล้วเปิดรายละเอียด", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("row")).toHaveCount(21);                       // หัว + 20
  await page.getByLabel("ค้นหา").fill("เว็บไซต์"); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/q=/);
  await page.getByRole("link", { name: "31900-0001" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("การสร้างเว็บไซต์");
  for (const h of ["อ้างอิงมาตรฐาน", "ผลลัพธ์การเรียนรู้ระดับรายวิชา", "จุดประสงค์รายวิชา", "สมรรถนะรายวิชา", "คำอธิบายรายวิชา"])
    await expect(page.getByRole("heading", { name: h })).toBeVisible();
});
test("ตัวกรองหมวดและหน้า 2 คงอยู่ใน URL", async ({ page }) => {
  await page.goto("/"); await page.getByLabel("หมวดวิชา").selectOption({ label: /1\.1/ });
  await expect(page).toHaveURL(/category=\d+/);
  await page.getByRole("link", { name: "ถัดไป" }).click(); await expect(page).toHaveURL(/page=2/);
});
test("ไม่พบผลลัพธ์", async ({ page }) => {
  await page.goto("/?q=zzzzzz"); await expect(page.getByText("ไม่พบรายวิชาที่ตรงกับเงื่อนไข")).toBeVisible();
  await page.getByRole("link", { name: "ล้างตัวกรอง" }).click(); await expect(page).toHaveURL(/\/$/);
});
test("รหัสวิชาที่ไม่มีจริง → 404 ภาษาไทย", async ({ page }) => {
  const res = await page.goto("/courses/99999-9999"); expect(res?.status()).toBe(404);
  await expect(page.getByText("ไม่พบหน้าที่ต้องการ")).toBeVisible();
});
test("query string แปลก ๆ ไม่ทำให้ล้ม", async ({ page }) => {
  const res = await page.goto("/?page=abc&category=x&credits=-1&q=%25"); expect(res?.status()).toBe(200);
});
test("หน้าพิมพ์แสดงทุกแถวตามตัวกรอง", async ({ page }) => {
  await page.goto("/print"); await expect(page.getByRole("row")).toHaveCount(46);
});
```

- [ ] **Step 3: เขียนหน้า**

- `app/layout.tsx`: `lang="th"`, ฟอนต์ `Sarabun` ผ่าน `next/font/google` (subset `thai`, `latin`), title `ฐานข้อมูลรายวิชา ปวส. 2567 สาขาเทคโนโลยีสารสนเทศ`
- `(public)/layout.tsx`: แถบนำทาง `รายวิชา` (`/`), `สรุปภาพรวม` (`/dashboard`), `เข้าสู่ระบบ` (`/login`)
- `/`: ฟอร์ม GET (ไม่ใช้ client state) มีช่อง `ค้นหา`, select `หมวดวิชา` (ตัวเลือกจาก `listCategories` เยื้องตาม depth พร้อมจำนวนวิชา), select `หน่วยกิต`; ตารางคอลัมน์ รหัสวิชา / ชื่อวิชา (ไทยบน อังกฤษล่าง) / ท-ป-น / หมวด; บรรทัด `พบ N รายวิชา`; ลิงก์ `ส่งออก Excel` (`/api/export` + query เดิม) และ `พิมพ์ / บันทึก PDF` (`/print` + query เดิม); pagination `ก่อนหน้า`/`ถัดไป`; select เปลี่ยนค่าแล้ว submit ฟอร์มอัตโนมัติ
- `/courses/[code]`: `getCourseByCode(decodeURIComponent(code))` → `notFound()` ถ้า null; breadcrumb หมวด; `h1` = รหัส + ชื่อไทย; ชื่ออังกฤษ; ท-ป-น อธิบายเป็นคำ (`ทฤษฎี 1 ชม. ปฏิบัติ 4 ชม. 3 หน่วยกิต`); ห้าหัวข้อเป็น `h2` แสดงด้วย `whitespace-pre-line`; หัวข้อที่ว่างแสดง `—`; ปุ่มพิมพ์
- `/print`: ตารางทุกแถวจาก `allMatchingCourses` หัวเรื่องระบุเงื่อนไขที่ใช้ มี `@media print` ซ่อนแถบนำทางและปุ่ม ตั้ง `@page { size: A4; margin: 15mm }`
- `not-found.tsx`: `ไม่พบหน้าที่ต้องการ`; `error.tsx`: `เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล กรุณาตรวจสอบว่า Docker กำลังทำงานอยู่` พร้อมปุ่มลองใหม่

- [ ] **Step 4: รัน** — `npm run test:e2e` → PASS
- [ ] **Step 5: Commit** — `feat: add public course list, detail and print pages`

---

### Task 7: ส่งออก Excel

**Files:**
- Create: `lib/export.ts`, `app/api/export/route.ts`
- Test: `tests/unit/export.test.ts`, เพิ่มใน `tests/e2e/public.spec.ts`

**Interfaces:**
- Consumes: `allMatchingCourses`, `parseFilter`, `CourseListItem`
- Produces: `coursesToXlsx(items: CourseListItem[]): Promise<Buffer>`

- [ ] **Step 1: การทดสอบ**

```ts
const read = async (buf: Buffer) => { const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf); return wb.getWorksheet("รายวิชา")!; };
test("หัวตารางและแถวข้อมูล", async () => {
  const ws = await read(await coursesToXlsx([item({ code: "31900-0001", nameTh: "การสร้างเว็บไซต์", nameEn: "Website Development", theoryHours: 1, practiceHours: 4, credits: 3, categoryName: "กลุ่มสมรรถนะวิชาชีพพื้นฐาน" })]));
  expect(ws.getRow(1).values).toEqual([, "รหัสวิชา", "ชื่อวิชา (ไทย)", "ชื่อวิชา (อังกฤษ)", "ทฤษฎี", "ปฏิบัติ", "หน่วยกิต", "หมวด/กลุ่มวิชา"]);
  expect(ws.getRow(2).values).toEqual([, "31900-0001", "การสร้างเว็บไซต์", "Website Development", 1, 4, 3, "กลุ่มสมรรถนะวิชาชีพพื้นฐาน"]);
});
test("ผลลัพธ์ว่างยังได้ไฟล์ที่มีหัวตาราง", async () => expect((await read(await coursesToXlsx([]))).rowCount).toBe(1));
test("ค่าที่ขึ้นต้นด้วย = ถูกเก็บเป็นข้อความ ไม่ใช่สูตร", async () => {
  const ws = await read(await coursesToXlsx([item({ nameTh: "=1+1" })]));
  expect(ws.getCell("B2").type).toBe(ExcelJS.ValueType.String);
});
```

E2E:

```ts
test("ดาวน์โหลด Excel ได้ครบทุกแถวตามตัวกรอง ไม่ใช่เฉพาะหน้าแรก", async ({ page }) => {
  await page.goto("/");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "ส่งออก Excel" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/^courses-\d{8}\.xlsx$/);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile((await dl.path())!);
  expect(wb.getWorksheet("รายวิชา")!.rowCount).toBe(46);
});
```

- [ ] **Step 2: เขียน** — route `GET` คืน `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="courses-YYYYMMDD.xlsx"`, `export const dynamic = "force-dynamic"`; แถวหัวตัวหนาและตรึงแถวแรก
- [ ] **Step 3: รัน** — `npm test && npm run test:e2e` → PASS
- [ ] **Step 4: Commit** — `feat: add Excel export`

---

### Task 8: ยืนยันตัวตนและสิทธิ์

**Files:**
- Create: `auth.config.ts`, `auth.ts`, `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`, `lib/authz.ts`, `app/login/page.tsx`, `app/login/actions.ts`, `app/admin/layout.tsx`, `app/admin/page.tsx`, `types/next-auth.d.ts`
- Test: `tests/db/authz.test.ts`, `tests/e2e/auth.spec.ts`

**Interfaces:**
- Consumes: `db`
- Produces:

```ts
// lib/authz.ts
class AuthzError extends Error { constructor(public reason: "UNAUTHENTICATED" | "FORBIDDEN") }
type SessionUser = { id: number; email: string; name: string; role: Role };
function checkAccess(userId: number | null, allowed: Role[]): Promise<SessionUser>;   // อ่านผู้ใช้จาก DB ทุกครั้ง
function requireRole(...allowed: Role[]): Promise<SessionUser>;                       // auth() → checkAccess
type ActionResult = { ok: true } | { ok: false; errors: Record<string, string> };     // key "_" = ข้อผิดพลาดทั้งฟอร์ม
```

- [ ] **Step 1: การทดสอบ `checkAccess`**

```ts
test("ไม่มี session → UNAUTHENTICATED", async () => await expect(checkAccess(null, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }));
test("ผู้ใช้ถูกลบแล้ว → UNAUTHENTICATED", async () => await expect(checkAccess(9999, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }));
test("ถูกปิดการใช้งานหลังล็อกอิน → UNAUTHENTICATED", async () => { const u = await mkUser({ role: "ADMIN", active: false }); await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "UNAUTHENTICATED" }); });
test("STAFF เรียกสิ่งที่ต้องเป็น ADMIN → FORBIDDEN", async () => { const u = await mkUser({ role: "STAFF" }); await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "FORBIDDEN" }); });
test("ใช้บทบาทปัจจุบันใน DB ไม่ใช่ที่ฝังใน session", async () => { const u = await mkUser({ role: "ADMIN" }); await db.user.update({ where: { id: u.id }, data: { role: "STAFF" } }); await expect(checkAccess(u.id, ["ADMIN"])).rejects.toMatchObject({ reason: "FORBIDDEN" }); });
test("ผ่าน", async () => { const u = await mkUser({ role: "STAFF" }); expect(await checkAccess(u.id, ["ADMIN", "STAFF"])).toMatchObject({ id: u.id, role: "STAFF" }); });
```

- [ ] **Step 2: เขียน auth**

- `auth.config.ts` (ไม่ import Prisma/bcrypt เพื่อให้ middleware รันบน edge ได้): `pages.signIn = "/login"`, session `jwt`, callback `authorized` คืน `false` สำหรับ `/admin/*` เมื่อไม่มี session, callbacks `jwt`/`session` ส่งต่อ `id` และ `role`
- `auth.ts`: Credentials provider; `authorize` ตรวจด้วย zod, หาอีเมล (lowercase + trim), คืน `null` ถ้าไม่พบ/`active` เป็น false/รหัสผ่านไม่ตรง
- `middleware.ts`: `matcher: ["/admin/:path*"]`
- `app/admin/layout.tsx`: เรียก `requireRole("ADMIN", "STAFF")`; `UNAUTHENTICATED` → `redirect("/login")`; แถบนำทาง `ภาพรวม`, `รายวิชา`, `หมวดวิชา`, `ผู้ใช้` (เฉพาะ ADMIN), `บัญชีของฉัน`, ปุ่ม `ออกจากระบบ`
- `app/admin/page.tsx`: ชั่วคราวแสดง `ยินดีต้อนรับ <ชื่อ>` (เติมเนื้อหาใน Task 9)
- `/login`: ฟอร์มอีเมล + รหัสผ่าน; ผิด → `อีเมลหรือรหัสผ่านไม่ถูกต้อง`; สำเร็จ → `/admin`

- [ ] **Step 3: E2E**

```ts
test("ผู้ไม่ล็อกอินถูกส่งไป /login", async ({ page }) => { await page.goto("/admin"); await expect(page).toHaveURL(/\/login/); });
test("รหัสผ่านผิดและอีเมลที่ไม่มี ได้ข้อความเดียวกัน", async ({ page }) => {
  for (const [e, p] of [["admin@test.local", "wrong"], ["nobody@test.local", "password-1234"]]) {
    await login(page, e, p); await expect(page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")).toBeVisible();
  }
});
test("ล็อกอินสำเร็จแล้วออกจากระบบ", async ({ page }) => {
  await login(page, "staff@test.local", "password-1234"); await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("link", { name: "ผู้ใช้" })).toHaveCount(0);
  await page.getByRole("button", { name: "ออกจากระบบ" }).click(); await page.goto("/admin"); await expect(page).toHaveURL(/\/login/);
});
```

ใส่ helper `login(page, email, password)` ใน `tests/e2e/helpers.ts`

- [ ] **Step 4: รัน** — `npm run test:db && npm run test:e2e` → PASS
- [ ] **Step 5: Commit** — `feat: add authentication and role checks`

---

### Task 9: ผู้ดูแล — รายวิชาและหมวดวิชา

**Files:**
- Create: `lib/validation.ts`, `app/admin/courses/page.tsx`, `app/admin/courses/new/page.tsx`, `app/admin/courses/[id]/page.tsx`, `app/admin/courses/actions.ts`, `app/admin/categories/page.tsx`, `app/admin/categories/actions.ts`, `components/course-form.tsx`, `components/category-form.tsx`, `components/confirm-delete.tsx`
- Modify: `app/admin/page.tsx`
- Test: `tests/unit/validation.test.ts`, `tests/db/admin-actions.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `requireRole`, `ActionResult`, `searchCourses`, `listCategories`
- Produces:

```ts
// lib/validation.ts
const courseSchema: z.ZodType<CourseInput>;      // code /^\d{5}-\d{4}$/, nameTh 1–300, nameEn ≤300, ชั่วโมง/หน่วยกิต จำนวนเต็ม 0–99, ข้อความยาว ≤10000, categoryId
const categorySchema: z.ZodType<CategoryInput>;  // code 1–20, name 1–300, minCredits 0–999 | null, parentId | null, sortOrder
// actions.ts — ตรรกะอยู่ในฟังก์ชันที่รับ user เพื่อทดสอบได้ ส่วน action ที่ export เรียก requireRole แล้วส่งต่อ
function saveCourse(id: number | null, input: unknown): Promise<ActionResult>;
function deleteCourse(id: number): Promise<ActionResult>;
function saveCategory(id: number | null, input: unknown): Promise<ActionResult>;
function deleteCategory(id: number): Promise<ActionResult>;
```

- [ ] **Step 1: การทดสอบ validation** (unit)

```ts
test.each([["31900-0001", true], ["3190-0001", false], ["31900_0001", false], ["", false]])("รหัส %s", (code, ok) => expect(courseSchema.safeParse({ ...valid, code }).success).toBe(ok));
test("ตัดช่องว่างหัวท้ายและแปลงสตริงว่างของช่องข้อความยาวเป็น null", () => expect(courseSchema.parse({ ...valid, nameTh: " ก ", description: "  " })).toMatchObject({ nameTh: "ก", description: null }));
test("ชั่วโมงติดลบ ทศนิยม หรือเกิน 99 ไม่ผ่าน", () => { for (const v of [-1, 1.5, 100]) expect(courseSchema.safeParse({ ...valid, credits: v }).success).toBe(false); });
test("ข้อความผิดพลาดเป็นภาษาไทย", () => { const r = courseSchema.safeParse({ ...valid, nameTh: "" }); expect(r.success ? "" : r.error.issues[0].message).toBe("กรุณากรอกชื่อวิชา"); });
```

- [ ] **Step 2: การทดสอบตรรกะ action** (db) — ทดสอบฟังก์ชันภายใน `saveCourseAs(user, …)` ฯลฯ

```ts
test("สร้างและแก้ไขตั้ง editedAt และล้าง needsReview เมื่อส่ง needsReview=false", …);
test("รหัสซ้ำ → { ok:false, errors:{ code:'รหัสวิชานี้มีอยู่แล้ว' } }", …);
test("แก้วิชาโดยคงรหัสเดิมไม่ถือว่าซ้ำ", …);
test("categoryId ที่ไม่มีจริง → errors.categoryId = 'ไม่พบหมวดวิชาที่เลือก'", …);
test("ลบหมวดที่มีรายวิชาหรือหมวดย่อย → errors._ = 'ลบไม่ได้: ยังมีรายวิชาหรือหมวดย่อยอยู่'", …);
test("ตั้ง parent เป็นตัวเองหรือเป็นลูกหลานของตัวเอง → errors.parentId = 'เลือกหมวดแม่ไม่ถูกต้อง'", …);
test("ลบ/แก้ id ที่ไม่มีแล้ว → errors._ = 'ไม่พบข้อมูล อาจถูกลบไปแล้ว'", …);
```

แต่ละกรณียืนยันทั้งค่าที่คืนและสถานะในฐานข้อมูล

- [ ] **Step 3: เขียนหน้าและ action**

- action ที่ export ทุกตัว: `requireRole("ADMIN", "STAFF")` → ตรรกะ → `revalidatePath("/")`, `/dashboard`, `/admin/…`
- `/admin`: จำนวนวิชา/หมวด และตาราง `รายวิชาที่ต้องตรวจสอบ` (รหัส ชื่อ `reviewNote`) ลิงก์ไปหน้าแก้ไข
- `/admin/courses`: ใช้ตัวกรองและตารางเดียวกับหน้าสาธารณะ + ตัวกรอง `เฉพาะที่ต้องตรวจสอบ`, ปุ่ม `เพิ่มรายวิชา`, ลิงก์ `แก้ไข`
- ฟอร์มรายวิชา: ทุกฟิลด์ของ `Course` ที่แก้ได้, textarea สำหรับห้าหัวข้อ, checkbox `ต้องตรวจสอบ`, แสดง `reviewNote` และ `sourcePage` (อ่านอย่างเดียว) ถ้ามี, ปุ่ม `บันทึก` และ `ลบ` (ยืนยันผ่าน dialog)
- `/admin/categories`: ต้นไม้หมวดพร้อมจำนวนวิชา, เพิ่ม/แก้ไขผ่าน dialog, ลบ

- [ ] **Step 4: E2E**

```ts
test("STAFF แก้ชื่อวิชาแล้วหน้าสาธารณะเปลี่ยนตาม", …);          // แก้ nameTh → ไปที่ /courses/<code> เห็นชื่อใหม่
test("เพิ่มวิชาด้วยรหัสซ้ำเห็นข้อความใต้ช่องรหัส", …);             // "รหัสวิชานี้มีอยู่แล้ว"
test("วิชาที่ต้องตรวจสอบแสดงในหน้า /admin และหายเมื่อยกเลิกเครื่องหมาย", …);
test("ลบหมวดที่มีรายวิชาเห็นข้อความปฏิเสธ", …);
```

- [ ] **Step 5: รัน** — `npm test && npm run test:db && npm run test:e2e` → PASS
- [ ] **Step 6: Commit** — `feat: add admin course and category management`

---

### Task 10: ผู้ดูแล — ผู้ใช้และบัญชีของฉัน

**Files:**
- Create: `lib/users.ts`, `app/admin/users/page.tsx`, `app/admin/users/actions.ts`, `app/admin/account/page.tsx`, `app/admin/account/actions.ts`, `components/user-form.tsx`
- Modify: `lib/validation.ts`
- Test: `tests/db/users.test.ts`, เพิ่มใน `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `requireRole`, `SessionUser`, `ActionResult`
- Produces (ใน `lib/users.ts`, รับ `actor: SessionUser`):

```ts
function createUser(actor, input: unknown): Promise<ActionResult>;                 // email, name, password ≥ 8, role
function updateUser(actor, id: number, input: unknown): Promise<ActionResult>;     // name, role, active
function resetPassword(actor, id: number, newPassword: string): Promise<ActionResult>;
function changeOwnPassword(actor, current: string, next: string): Promise<ActionResult>;
```

- [ ] **Step 1: การทดสอบ**

```ts
test("อีเมลซ้ำ (ไม่สนตัวพิมพ์) → errors.email = 'อีเมลนี้มีอยู่แล้ว'", …);
test("รหัสผ่านสั้นกว่า 8 → errors.password = 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร'", …);
test("รหัสผ่านถูกเก็บเป็น hash", …);
test("ADMIN ปิดการใช้งานหรือลดบทบาทตนเองไม่ได้ → errors._ = 'ไม่สามารถเปลี่ยนบทบาทหรือปิดการใช้งานบัญชีของตนเองได้'", …);
test("ลดบทบาท/ปิด ADMIN คนสุดท้ายที่ใช้งานได้ → errors._ = 'ต้องมีผู้ดูแลระบบที่ใช้งานได้อย่างน้อยหนึ่งคน'", …);   // ADMIN อีกคนมีอยู่แต่ active=false
test("มี ADMIN ใช้งานได้สองคน ลดบทบาทคนหนึ่งได้", …);
test("ผู้ใช้ที่ถูกปิดล็อกอินไม่ได้ และ checkAccess ปฏิเสธ", …);
test("changeOwnPassword: รหัสเดิมผิด → errors.current = 'รหัสผ่านปัจจุบันไม่ถูกต้อง'; ถูก → ล็อกอินด้วยรหัสใหม่ได้", …);
```

E2E:

```ts
test("STAFF เข้า /admin/users ไม่ได้", …);        // เห็น "คุณไม่มีสิทธิ์เข้าถึงหน้านี้"
test("ADMIN เพิ่มผู้ใช้ STAFF แล้วผู้ใช้ใหม่ล็อกอินได้", …);
test("ADMIN ปิดการใช้งานผู้ใช้ ขณะที่ผู้ใช้นั้นยังล็อกอินอยู่ → การบันทึกครั้งถัดไปของผู้ใช้นั้นถูกส่งไป /login", …);   // ใช้ browser context สองตัว
```

- [ ] **Step 2: เขียน** — action ใน `users/actions.ts` ใช้ `requireRole("ADMIN")`; ใน `account/actions.ts` ใช้ `requireRole("ADMIN", "STAFF")`; `app/admin/users/page.tsx` จับ `AuthzError("FORBIDDEN")` แล้วแสดง `คุณไม่มีสิทธิ์เข้าถึงหน้านี้`; ตรวจกฎ ADMIN คนสุดท้ายภายใน transaction
- [ ] **Step 3: รัน** — `npm run test:db && npm run test:e2e` → PASS
- [ ] **Step 4: Commit** — `feat: add user management and password change`

---

### Task 11: แดชบอร์ดสรุป และเอกสารการรัน

**Files:**
- Create: `app/(public)/dashboard/page.tsx`, `components/charts/category-bar.tsx`, `components/charts/credits-bar.tsx`, `components/charts/hours-donut.tsx`, `README.md`
- Test: `tests/e2e/dashboard.spec.ts`

**Interfaces:**
- Consumes: `getStats`

- [ ] **Step 1: E2E**

```ts
test("แดชบอร์ดแสดงตัวเลขตรงกับข้อมูล", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("total-courses")).toHaveText("45");
  const row = page.getByRole("row", { name: /หมวด .*1/ }).first();   // ตารางประกอบกราฟ
  await expect(row).toBeVisible();
  await expect(page.locator("svg.recharts-surface")).toHaveCount(3);
});
```

- [ ] **Step 2: เขียนหน้า**

อ่าน skill `dataviz` ก่อนเขียนกราฟ แล้วทำ: ตัวเลขสรุป (จำนวนวิชาทั้งหมด, หน่วยกิตขั้นต่ำตามโครงสร้าง 80); กราฟแท่งแนวนอนจำนวนวิชาต่อหมวดระดับบนสุด; กราฟแท่งจำนวนวิชาตามหน่วยกิต; สัดส่วนชั่วโมงทฤษฎี/ปฏิบัติ; ใต้กราฟแต่ละอันมีตารางตัวเลข และตารางโครงสร้างหลักสูตร (หมวด/กลุ่มแบบเยื้อง, หน่วยกิตขั้นต่ำ, จำนวนวิชา, หน่วยกิตรวมของวิชาที่มี); กราฟเป็น client component รับข้อมูลผ่าน props

- [ ] **Step 3: `README.md`** — ขั้นตอนในข้อ 10 ของ spec, คำสั่งทดสอบสามชุด, วิธีเปลี่ยนรหัสผ่าน ADMIN แรก, วิธีรัน extract/seed ซ้ำและความหมายของ `--force`
- [ ] **Step 4: ตรวจรวม**

```bash
npm run lint && npm test && npm run test:db && npm run test:e2e && npm run build
```

Expected: ผ่านทั้งหมด จากนั้น `npm run dev` กับฐาน `courses` จริง: จำนวนวิชาต่อหมวดบน `/dashboard` ตรงกับ `Data/extracted/report.txt`; ค้นหา `31900-0001` เจอ; ล็อกอินด้วย `ADMIN_EMAIL` ได้

- [ ] **Step 5: Commit** — `feat: add dashboard and run instructions`
