# รองรับหลายสาขา (ปวช./ปวส.) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ระบบเก็บ นำเข้า และแสดงรายวิชาของหลายสาขา (ปวช. และ ปวส. 2567) โดยวิชาที่ใช้ร่วมกันมีเนื้อหาชุดเดียว

**Architecture:** เพิ่มตาราง `Program` และ `ProgramCourse` (ตำแหน่งของวิชาในสาขา) แยก "เนื้อหาวิชา" (`Course`) ออกจาก "วิชาอยู่หมวดไหนของสาขาไหน"; หมวดเป็นของสาขา ไฟล์ทะเบียน `Data/programs.json` ขับทั้ง extract และ seed หน้าเว็บสาธารณะย้ายไปอยู่ใต้ `/p/[code]` และ `/` กลายเป็นรายชื่อหลักสูตร

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Prisma 6, PostgreSQL 16, zod, pdfjs-dist, tsx, Vitest, Playwright (ของเดิมทั้งหมด ไม่เพิ่ม dependency)

**Spec:** `docs/superpowers/specs/2026-11-13-multi-program-design.md`

## Global Constraints

- ข้อความบนหน้าเว็บเป็นภาษาไทยทั้งหมด
- ระดับ: enum `Level { PVC PVS }` แสดงผลเป็น `ปวช.` / `ปวส.`
- รหัสสาขาเป็นตัวเลข 5 หลัก (`/^\d{5}$/`); URL ใช้รหัสสาขา `/p/31901`
- หลักสูตรปีเดียว `year` ค่าเริ่มต้น 2567
- สิทธิ์ไม่แยกตามสาขา: หน้าสาขา/หมวด/วิชา = `ADMIN` และ `STAFF`; หน้าผู้ใช้ = `ADMIN`
- ห้ามเพิ่ม dependency ใหม่
- ข้อความตายตัวที่การทดสอบอ้างถึง (เดิมยังใช้ทั้งหมด) เพิ่ม:
  - ลบสาขาไม่ได้: `ลบไม่ได้: ยังมี N วิชาในสาขานี้` (N เป็นตัวเลข)
  - หมวดไม่ตรงสาขา: `หมวดนี้ไม่ได้อยู่ในสาขาที่เลือก`
  - สาขาซ้ำในฟอร์มวิชา: `เลือกสาขานี้ซ้ำ`
  - วิชาไม่มีสาขา (คำเตือน ไม่ใช่ error): `วิชานี้จะไม่แสดงในหน้ารายวิชาของสาขาใด`
  - วิชาใช้ร่วม: `เนื้อหาวิชานี้ใช้ร่วมกับ N สาขา แก้แล้วมีผลทุกสาขา`
  - หมายเหตุเนื้อหาต่าง (seed): `เนื้อหาต่างจากหลักสูตร <code>: <ชื่อช่อง>` คั่นช่องด้วย `, `
  - รายละเอียดวิชาที่ไม่มีสาขา: `ยังไม่อยู่ในหลักสูตรใด`
- ทุก commit ลงท้ายด้วย `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- ต้องรัน `docker compose up -d` ก่อน `npm run test:db` และ `npm run test:e2e`

## Review Focus

1. **seed รันซ้ำสองครั้งติดกัน** ด้วยข้อมูลสองสาขาที่มีเนื้อหาต่างกัน → ครั้งที่สองไม่ต่อหมายเหตุ "เนื้อหาต่าง…" ซ้ำ ไม่สร้างแถวซ้ำ ตัวเลขสรุป "เนื้อหาไม่ตรง" ยังเท่าเดิม (Task 4)
2. **ฟอร์มวิชาถูกส่งตรง ๆ** ด้วย `categoryId` ของสาขาอื่น หรือ `programId` ที่ไม่มีจริง → ปฏิเสธรายแถว ไม่บันทึกอะไรเลย ทั้งเนื้อหาและตำแหน่ง (Task 6)
3. **`/api/export` ไม่มี `program` หรือรหัสไม่มีจริง** → 404 ไม่ใช่ส่ง Excel ของทุกวิชา (Task 5)
4. **รหัสสาขาแปลกใน URL** (`/p/abc`, `/p/3190`, `/p/99999`) → หน้า 404 ภาษาไทย ไม่ล้ม (Task 5)
5. **วิชาที่ไม่มีตำแหน่งในสาขาใด** → ยังเจอใน `/search` และ `/admin/courses`, หน้ารายละเอียดแสดง `ยังไม่อยู่ในหลักสูตรใด`, ไม่โผล่ในหน้าสาขาใด (Task 5)

---

## โครงสร้างไฟล์

```
prisma/schema.prisma                         + Level, Program, ProgramCourse; Category.programId; Course.sourceProgramCode
prisma/migrations/<ts>_multi_program/migration.sql   ย้ายข้อมูลเดิมเข้าสาขา 31901
prisma/seed.ts                               วนทุกสาขาในไฟล์ทะเบียน
Data/programs.json                           ไฟล์ทะเบียน (ใหม่)
Data/extracted/<code>.json, <code>.report.txt  (courses.json/report.txt → 31901.*)
lib/program-registry.ts                      zod schema + loadRegistry (ใหม่)
lib/programs.ts                              listPrograms, getProgramByCode, save/deleteProgram (ใหม่)
lib/courses.ts                               ค้นหา/สถิติรับ programId
lib/course-admin.ts                          saveCourse รับ placements, หมวดผูกสาขา
lib/seed-data.ts                             seedProgram + กติกาวิชาร่วม
lib/validation.ts                            placements, programSchema, categorySchema.programId
scripts/pdf/extract.ts                       รับรหัสสาขา อ่านช่วงหน้าจากทะเบียน
scripts/pdf/parse.ts                         รองรับรูปแบบ ปวช.
app/(public)/page.tsx                        รายชื่อหลักสูตร (เขียนใหม่)
app/(public)/p/[code]/{page,dashboard/page,print/page}.tsx   (ย้ายจากของเดิม)
app/(public)/search/page.tsx                 ค้นหาข้ามสาขา (ใหม่)
app/(public)/courses/[code]/page.tsx         ตาราง "อยู่ในหลักสูตร"
app/api/export/route.ts                      ต้องมี program
app/admin/programs/{page,actions}.tsx        (ใหม่)
app/admin/{page,categories,courses}/…        ตัวเลือก/ตัวกรองสาขา
components/placements-field.tsx              แถว สาขา/หมวด ในฟอร์มวิชา (client, ใหม่)
components/program-badge.tsx                 ป้าย "ปวช. เทคโนโลยีสารสนเทศ" (ใหม่)
tests/db/migration.test.ts, programs.test.ts (ใหม่); tests/unit/program-registry.test.ts (ใหม่)
tests/fixtures/pdf-lines-pvc.ts              บรรทัดตัวอย่างจากเล่ม ปวช. (ใหม่)
```

---

### Task 1: Schema, migration และปรับ lib ให้ทำงานกับสาขาเดียว

ทุกอย่างยังเป็นสาขาเดียว หน้าเว็บเดิมใช้สาขาแรกชั่วคราว (Task 5 แทนที่) เทสต์เดิมทั้งหมดต้องผ่านหลังปรับ fixture

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_multi_program/migration.sql`, `lib/program-registry.ts`, `lib/programs.ts`, `tests/db/migration.test.ts`
- Modify: `lib/courses.ts`, `lib/course-admin.ts`, `lib/validation.ts`, `lib/seed-data.ts`, `prisma/seed.ts`, หน้าใน `app/(public)` และ `app/admin/categories` ที่เรียกฟังก์ชันซึ่งเปลี่ยน signature, `tests/db/setup.ts`, `tests/e2e/global-setup.ts`, เทสต์ db ทุกไฟล์ที่สร้าง category/course

**Interfaces:**
- Produces:
  - `lib/program-registry.ts`: `programEntrySchema` (zod: `code` 5 หลัก, `level` `"PVC"|"PVS"`, `name`, `typeName` ไม่ว่าง, `pdf` ไม่ว่าง, `pages: [number, number]` เต็มบวกและ `pages[0] <= pages[1]`), `type ProgramEntry`
  - `lib/programs.ts`: `type ProgramSummary = { id; code; level: Level; name; typeName; sortOrder; courseCount: number }`; `listPrograms(): Promise<ProgramSummary[]>` (เรียง `sortOrder, code`); `getProgramByCode(code: string): Promise<ProgramSummary | null>` (รหัสที่ไม่ตรง `/^\d{5}$/` → null โดยไม่ query)
  - `lib/courses.ts`:
    - `CourseFilter` เพิ่ม `programId: number | null` (`parseFilter` คืน `null` เสมอ หน้าเป็นคนใส่)
    - `CourseListItem.categoryName: string | null` (null เมื่อ `programId` เป็น null) และเพิ่ม `programs: { code: string; level: Level; name: string }[]`
    - `programId` ไม่ null → เฉพาะวิชาที่มี `ProgramCourse` ในสาขานั้น; `categoryId` ใช้ได้เฉพาะหมวดของสาขานั้น ไม่งั้นเพิกเฉย
    - `listCategories(programId: number)`, `listCreditValues(programId: number | null)`, `getStats(programId: number)`
    - `getCourseByCode(code)` คืน `Course & { placements: { program: { code; level; name }; path: { code; name }[] }[] }` เรียงตาม `program.sortOrder`
  - `lib/course-admin.ts`: `saveCategory(id, input)` ต้องมี `programId`; หมวดแม่ต้องอยู่สาขาเดียวกัน (`fail("parentId", "เลือกหมวดแม่ไม่ถูกต้อง")`); `deleteCategory` นับ `ProgramCourse` แทน `Course`; `saveCourse` ชั่วคราวยังรับ `categoryId` แล้วแทนที่ตำแหน่งของวิชาในสาขาของหมวดนั้น (Task 6 เปลี่ยนเป็น `placements`)
  - `lib/seed-data.ts`: `seedFromExtracted(db, program: ProgramEntry, data: Extracted, opts?: { force?: boolean })` สร้างสาขาถ้ายังไม่มี, หมวดผูก `programId`, ตำแหน่งสร้างเฉพาะที่ยังไม่มี (ยกเว้น `force`), เนื้อหาวิชาตามกติกาเดิม; คืนค่าเดิม `{ created; updated; skipped }`

- [ ] **Step 1: เขียน `tests/db/migration.test.ts` (failing)**

ทดสอบ SQL ของ migration กับ schema แยก `migtest`: สร้าง schema → รัน `prisma/migrations/20261112135009_init/migration.sql` → ใส่ข้อมูลแบบเก่า → รัน migration ใหม่ → ตรวจ รัน SQL หลายคำสั่งด้วย `npx prisma db execute --url <TEST_DATABASE_URL> --file <tmp>` โดยไฟล์ tmp = `SET search_path TO migtest;\n` + เนื้อหา SQL (`DROP SCHEMA IF EXISTS migtest CASCADE` ทั้งก่อนและหลังเทสต์)

ข้อมูลเก่า: หมวด `1` และ `1.1` (แม่ = `1`), วิชา `30000-1101` (หมวด 1.1, `sourcePage` 61, `needsReview` true, `reviewNote` "x"), วิชา `30000-9999` (หมวด 1, `sourcePage` null, `editedAt` ตั้งค่า)

```ts
test("migration ย้ายข้อมูลเดิมเข้าสาขา 31901 ครบ", async () => {
  // ...apply init, insert old rows, apply new migration...
  const program = await q(`SELECT code, level, name, "typeName" FROM migtest."Program"`);
  expect(program).toEqual([{ code: "31901", level: "PVS", name: "เทคโนโลยีสารสนเทศ",
    typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ" }]);
  expect(await q(`SELECT code FROM migtest."Category" WHERE "programId" IS NULL`)).toEqual([]);
  expect(await q(`SELECT c.code, cat.code AS cat, pc."sourcePage" FROM migtest."ProgramCourse" pc
      JOIN migtest."Course" c ON c.id = pc."courseId" JOIN migtest."Category" cat ON cat.id = pc."categoryId"
      ORDER BY c.code`)).toEqual([
    { code: "30000-1101", cat: "1.1", sourcePage: 61 },
    { code: "30000-9999", cat: "1", sourcePage: null },
  ]);
  expect(await q(`SELECT code, "sourceProgramCode", "needsReview", "reviewNote", "editedAt" IS NOT NULL AS edited
      FROM migtest."Course" ORDER BY code`)).toEqual([
    { code: "30000-1101", sourceProgramCode: "31901", needsReview: true, reviewNote: "x", edited: false },
    { code: "30000-9999", sourceProgramCode: null, needsReview: false, reviewNote: null, edited: true },
  ]);
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม** — `npx vitest run --project db tests/db/migration.test.ts` → FAIL (ไม่มีไฟล์ migration ใหม่)

- [ ] **Step 3: แก้ `prisma/schema.prisma` ตาม spec หัวข้อ 3 แล้วสร้าง migration**

`npx prisma migrate dev --create-only --name multi_program` แล้วแก้ SQL ที่ได้ให้ทำตาม spec หัวข้อ 3 "Migration ข้อมูลเดิม" ข้อ 1–5 ตามลำดับ (เพิ่ม `programId` แบบ nullable → เติมค่า → `SET NOT NULL`; สร้าง `ProgramCourse` จาก `Course` ด้วย `INSERT … SELECT` ก่อน `DROP COLUMN`) และให้รันได้กับฐานว่าง (ไม่มีหมวด/วิชา) ด้วย

- [ ] **Step 4: รัน migration test ให้ผ่าน** — คำสั่งเดิม → PASS

- [ ] **Step 5: ปรับ fixture ของเทสต์เดิม**

`tests/db/setup.ts` และ `tests/e2e/global-setup.ts`: TRUNCATE เพิ่ม `"ProgramCourse", "Program"`; เทสต์ db ที่สร้างหมวด/วิชาเองสร้างสาขา `31901` ก่อน และสร้างวิชาผ่าน `ProgramCourse`; `f()` ใน `tests/db/courses.test.ts` ใส่ `programId: program.id`; e2e global-setup ส่ง `ProgramEntry` ของ 31901 (ค่าเดียวกับ `Data/programs.json` ใน Task 2) เป็นอาร์กิวเมนต์ที่สองของ `seedFromExtracted`

- [ ] **Step 6: เพิ่มเทสต์ db ใหม่ของพฤติกรรมที่เปลี่ยน (failing)**

ใน `tests/db/courses.test.ts`:
```ts
test("หมวดของสาขาอื่นถูกเพิกเฉย", async () => {
  const other = await db.program.create({ data: { code: "21901", level: "PVC", name: "อื่น", typeName: "อื่น" } });
  const foreign = await db.category.create({ data: { code: "1", name: "หมวดสาขาอื่น", programId: other.id } });
  expect((await searchCourses(f({ categoryId: foreign.id }))).total).toBe(27);
});
test("ค้นข้ามสาขา (programId null) ได้ categoryName null และรายชื่อสาขา", async () => {
  const r = await searchCourses(f({ programId: null, q: "30000-1101" }));
  expect(r.items[0]).toMatchObject({ categoryName: null, programs: [{ code: "31901", level: "PVS" }] });
});
```
ใน `tests/db/admin-actions.test.ts`:
```ts
test("หมวดแม่ต้องอยู่สาขาเดียวกัน", async () => { /* parent ของสาขาอื่น → errors.parentId === "เลือกหมวดแม่ไม่ถูกต้อง" */ });
test("รหัสหมวดซ้ำได้ข้ามสาขา แต่ซ้ำในสาขาเดียวไม่ได้", async () => { /* "1" ในสองสาขา → ok; ซ้ำในสาขาเดิม → errors.code === "รหัสหมวดนี้มีอยู่แล้ว" */ });
```

- [ ] **Step 7: ปรับ `lib/` และหน้าเว็บให้ผ่าน**

ทำตาม Interfaces ด้านบน `getStats`/`rolledUpTotals` นับจาก `ProgramCourse` ของสาขา; หน้าใน `app/(public)` และ `app/admin/categories` ชั่วคราวใช้ `(await listPrograms())[0]` เป็นสาขาปัจจุบัน (ฟอร์มหมวดส่ง `programId` เป็น hidden input) `prisma/seed.ts` ชั่วคราวส่ง `ProgramEntry` ของ 31901 ที่เขียนไว้ในไฟล์

- [ ] **Step 8: รันทุกชุด** — `npx prisma generate && npx tsc --noEmit && npm run lint && npm test && npm run test:db` → ผ่านทั้งหมด แล้ว `npm run test:e2e` → 24 passed

- [ ] **Step 9: Commit** — `feat: add programs and per-program course placement to the schema`

---

### Task 2: ไฟล์ทะเบียนและ extract แยกตามสาขา

**Files:**
- Create: `Data/programs.json`, `tests/unit/program-registry.test.ts`
- Modify: `lib/program-registry.ts`, `scripts/pdf/extract.ts`, `.gitignore` ถ้าจำเป็น (ต้อง commit `Data/programs.json` และ `Data/extracted/*`)
- Rename: `Data/extracted/courses.json` → `31901.json`, `report.txt` → `31901.report.txt` (`git mv`)

**Interfaces:**
- Consumes: `programEntrySchema`, `ProgramEntry` (Task 1)
- Produces: `loadRegistry(file = "Data/programs.json"): ProgramEntry[]` — โยน `Error` ที่ข้อความขึ้นต้นด้วย `Data/programs.json:` และบอกตำแหน่ง (เช่น `[1].pages`) หรือรหัสที่ซ้ำ; ลำดับในไฟล์คือลำดับที่คืน · `extractedPath(code) = "Data/extracted/<code>.json"` · `reportPath(code) = "Data/extracted/<code>.report.txt"`

- [ ] **Step 1: เขียน `tests/unit/program-registry.test.ts` (failing)** — เขียนไฟล์ชั่วคราวใน `os.tmpdir()`:

```ts
test("อ่านไฟล์จริงได้และเรียงตามไฟล์", () =>
  expect(loadRegistry().map((p) => p.code)).toEqual(["31901", "21901"]));
test("รหัสซ้ำ", () => expect(() => loadRegistry(tmp([e("31901"), e("31901")]))).toThrow(/ซ้ำ.*31901/));
test("ระดับผิด", () => expect(() => loadRegistry(tmp([{ ...e("1"), level: "BBA" }]))).toThrow(/\[0\]\.level/));
test("ช่วงหน้ากลับด้าน", () => expect(() => loadRegistry(tmp([{ ...e("31901"), pages: [50, 10] }]))).toThrow(/\[0\]\.pages/));
test("ไม่ใช่ JSON", () => expect(() => loadRegistry(tmpRaw("{"))).toThrow(/programs\.json/));
```

- [ ] **Step 2: รันให้ล้ม** — `npx vitest run --project unit tests/unit/program-registry.test.ts` → FAIL

- [ ] **Step 3: สร้าง `Data/programs.json`** ด้วยค่าใน spec หัวข้อ 4 ตรงตัว (31901: หน้า 37–106; 21901: หน้า 14–81) แล้วเขียน `loadRegistry` (ใช้ `z.array(programEntrySchema)` + ตรวจรหัสซ้ำ, แปลง `ZodError` เป็นข้อความรวม path)

- [ ] **Step 4: รันให้ผ่าน** — คำสั่งเดิม → PASS

- [ ] **Step 5: ปรับ `scripts/pdf/extract.ts`**

`npm run extract -- [code…]`: ไม่ระบุ = ทุกสาขาในทะเบียน; สาขาที่ไม่มีไฟล์ `Data/<pdf>` → พิมพ์ `ข้าม <code>: ไม่พบไฟล์ Data/<pdf>` แล้วไปต่อ; รหัสที่ไม่อยู่ในทะเบียน → error ออกด้วย exit 1; ใช้ช่วงหน้าจากทะเบียน; บรรทัดแรกของรายงาน `แหล่งข้อมูล: Data/<pdf> หน้า <a>–<b>` เขียน `extractedPath`/`reportPath`; `git mv` ไฟล์เดิมสองไฟล์

- [ ] **Step 6: ยืนยันว่าเล่ม 31901 ได้ผลเท่าเดิม**

Run: `npm run extract -- 31901 && git diff --stat -- Data/extracted/`
Expected: `31901.json` ไม่มีความต่าง (rename 100%); `31901.report.txt` ต่างเฉพาะบรรทัดแรกถ้ามี

- [ ] **Step 7: รันทุกชุดแล้ว commit** — `npm test && npx tsc --noEmit` → ผ่าน; commit `feat: drive extraction from a program registry`

---

### Task 3: ตัวแยกรองรับรูปแบบเล่ม ปวช. และแยกเล่ม 21901

**Files:**
- Create: `tests/fixtures/pdf-lines-pvc.ts` (บรรทัดตัวอย่างคัดจากเล่ม 21901 ในรูป `Line[]` เดียวกับ `tests/fixtures/pdf-lines.ts`)
- Modify: `scripts/pdf/parse.ts`, `tests/unit/pdf-parse.test.ts`
- Create (ผลลัพธ์): `Data/extracted/21901.json`, `21901.report.txt`

**Interfaces:**
- Consumes: `parseDocument(lines: Line[]): Extracted` (ของเดิม signature ไม่เปลี่ยน)

fixture ต้องมีอย่างน้อย: หน้าตารางโครงสร้างที่มีหัวหมวด `1.` / `1.1` / `2.` / `2.1` / `4.` "กิจกรรมเสริมหลักสูตร" (ไม่มีป้าย "รายวิชาปรับพื้นฐานวิชาชีพ"), แถววิชา `20000-1101` ในหมวด 1.1, แถว `21900-1001` ในหมวด 2.1 (ท-ป-น เป็น `1-2` `-` `2`), แถวรหัสถูกหั่น `[95,"20000-20"],[139,"03"],[200,"กิจกรรมเสริมสร้างสุจริต จิตอาสา"],[498,"0"],[504,"-"],[507,"2"],[513,"-"],[516,"0"]`, หน้าหัวข้อ "หมวดวิชาสมรรถนะแกนกลาง" + "(รายละเอียดคำอธิบายรายวิชา ตามเอกสารนอกเล่ม)", บล็อกคำอธิบายของ `21900-1001` ที่มีบรรทัด `[72,"(เว้นระยะอักษร"],[115,"10"],[122,")"]` คั่นระหว่างทุกหัวข้อ

- [ ] **Step 1: เขียนเทสต์ (failing) ใน `tests/unit/pdf-parse.test.ts`**

```ts
describe("เล่ม ปวช.", () => {
  const data = parseDocument(pvcLines);
  test("หมวดเลขมีจุด ไม่มี PRE", () =>
    expect(data.categories.map((c) => c.code)).toEqual(["1", "1.1", "2", "2.1", "4"]));
  test("รหัสถูกหั่นที่ x ห่างกัน", () =>
    expect(data.courses.find((c) => c.code === "20000-2003")).toMatchObject({ nameTh: "กิจกรรมเสริมสร้างสุจริต จิตอาสา", credits: 0, categoryCode: "4" }));
  test("ข้อความแม่แบบ (เว้นระยะอักษร …) ไม่ปนในเนื้อหา", () => {
    const c = data.courses.find((c) => c.code === "21900-1001")!;
    for (const v of [c.standardRef, c.learningOutcome, c.objectives, c.competencies, c.description])
      expect(v).not.toMatch(/เว้นระยะ/);
    expect(c.reviewReasons).toEqual([]);
  });
  test("หมวดแกนกลางที่คำอธิบายอยู่นอกเล่ม ไม่ติดธง", () =>
    expect(data.courses.find((c) => c.code === "20000-1101")).toMatchObject({ description: null, needsReview: false }));
});
```

- [ ] **Step 2: รันให้ล้ม** — `npx vitest run --project unit tests/unit/pdf-parse.test.ts` → FAIL เฉพาะ describe ใหม่

- [ ] **Step 3: แก้ `scripts/pdf/parse.ts`** เฉพาะจุดที่เทสต์ล้ม: ตัดบรรทัดที่ `foldThai` ขึ้นต้น `(เว้นระยะอักษร` ก่อนเข้าลูป; หมวด PRE สร้างเฉพาะเมื่อเจอป้าย; ส่วนอื่นแก้ตามที่เทสต์ชี้ ห้ามแตะค่าคงที่ที่ทำให้เทสต์เล่ม ปวส. เดิมเปลี่ยนผล

- [ ] **Step 4: รันให้ผ่าน และยืนยันเล่มเดิมไม่เปลี่ยน**

Run: `npm test && npm run extract -- 31901 && git diff --stat -- Data/extracted/31901.json`
Expected: เทสต์ผ่านทั้งหมด; `31901.json` ไม่มีความต่าง

- [ ] **Step 5: แยกเล่ม 21901 และตรวจกับเล่มจริง**

Run: `npm run extract -- 21901`
เปิด `Data/extracted/21901.report.txt` เทียบจำนวนวิชาต่อหมวดกับตารางหน้า 14–24 ของ PDF ทีละหมวด; "รายวิชาที่ต้องตรวจสอบ" ต้องไม่มีวิชา 20000-1xxx ที่ติดเพียงเพราะไม่มีคำอธิบาย และ "(ไม่มีหมวด)" ต้องเป็น 0 ถ้าไม่ตรง → กลับไป Step 1 เพิ่มบรรทัดตัวอย่างของกรณีนั้นใน fixture แล้วแก้ parser

- [ ] **Step 6: Commit** — รวม `21901.json` และรายงาน; `feat: parse vocational-certificate (ปวช.) curriculum booklets`

---

### Task 4: Seed หลายสาขาและกติกาวิชาร่วม

**Files:**
- Modify: `lib/seed-data.ts`, `prisma/seed.ts`, `tests/db/seed.test.ts`

**Interfaces:**
- Consumes: `loadRegistry`, `extractedPath` (Task 2); `seedFromExtracted` (Task 1)
- Produces: `seedFromExtracted(db, program, data, opts)` คืน `SeedSummary = { created: number; updated: number; shared: number; filled: number; conflicts: number; skipped: number }` (`shared` = วิชาที่มีอยู่แล้วและเจ้าของเป็นสาขาอื่น; `filled` = จำนวนวิชาที่ถูกเติมช่องว่างอย่างน้อยหนึ่งช่อง; `conflicts` = จำนวนวิชาที่มีช่องต่างกัน)

ช่องเนื้อหาที่เทียบ/เติม: `nameTh, nameEn, theoryHours, practiceHours, credits, standardRef, learningOutcome, objectives, competencies, description` ("ว่าง" = `null` หรือ `""`; ชื่อช่องในหมายเหตุใช้ชื่อ field ภาษาอังกฤษตามนี้) เทียบข้อความหลังแทน `\s+` ด้วยช่องว่างเดียวและ trim

- [ ] **Step 1: เขียนเทสต์ (failing) ใน `tests/db/seed.test.ts`** — `pvs = ProgramEntry 31901`, `pvc = ProgramEntry 21901`

```ts
test("วิชาใหม่: เจ้าของคือสาขาที่นำเข้า", async () => {
  await seedFromExtracted(db, pvs, data);
  expect((await db.course.findUniqueOrThrow({ where: { code: "30000-1101" } })).sourceProgramCode).toBe("31901");
});
test("สาขาอื่นเติมได้เฉพาะช่องว่าง เนื้อหาต่างได้ธงพร้อมหมายเหตุ", async () => {
  await seedFromExtracted(db, pvs, withCourse({ code: "X-1", description: null, objectives: "ก" }));
  const r = await seedFromExtracted(db, pvc, withCourse({ code: "X-1", description: "คำอธิบาย", objectives: "ข" }));
  expect(r).toMatchObject({ created: 0, shared: 1, filled: 1, conflicts: 1 });
  expect(await db.course.findUniqueOrThrow({ where: { code: "X-1" } })).toMatchObject({
    description: "คำอธิบาย", objectives: "ก", sourceProgramCode: "31901",
    needsReview: true, reviewNote: expect.stringContaining("เนื้อหาต่างจากหลักสูตร 21901: objectives"),
  });
});
test("ช่องว่างต่างกันไม่ถือว่าเนื้อหาต่าง", async () => { /* "ก  ข" กับ "ก ข" → conflicts 0 */ });
test("seed ซ้ำสองรอบไม่ต่อหมายเหตุซ้ำ", async () => {
  // seed pvs แล้ว pvc (เนื้อหาต่าง) สองรอบ → reviewNote มีข้อความ "เนื้อหาต่างจากหลักสูตร 21901" ครั้งเดียว,
  // รอบสองคืน conflicts 1 เท่าเดิม, db.programCourse.count() เท่ากับหลังรอบแรก
});
test("เจ้าของอัปเดตเนื้อหาได้ แต่ไม่ทับวิชาที่แก้ผ่านเว็บ เว้นแต่ force", async () => { /* ตามเทสต์เดิม ปรับ signature */ });
test("ไม่ทับตำแหน่งที่ย้ายผ่านเว็บ และไม่ทับชื่อสาขาที่แก้ เว้นแต่ force", async () => { /* ย้าย ProgramCourse.categoryId และแก้ Program.name → seed → คงเดิม; force → กลับตาม data */ });
test("วิชาเดียวอยู่สองสาขา", async () => {
  await seedFromExtracted(db, pvs, data); await seedFromExtracted(db, pvc, data);
  expect(await db.programCourse.count({ where: { course: { code: "30000-1101" } } })).toBe(2);
});
```

- [ ] **Step 2: รันให้ล้ม** — `npx vitest run --project db tests/db/seed.test.ts` → FAIL

- [ ] **Step 3: เขียนกติกาใน `lib/seed-data.ts`** ตาม spec หัวข้อ 4 "นำเข้า" ข้อ 1–5; ก่อนต่อหมายเหตุ ตรวจว่ามีข้อความ `เนื้อหาต่างจากหลักสูตร <code>` อยู่แล้วหรือยัง (ถ้ามี แทนที่ส่วนนั้นด้วยรายการช่องล่าสุด)

- [ ] **Step 4: รันให้ผ่าน** — คำสั่งเดิม → PASS

- [ ] **Step 5: ปรับ `prisma/seed.ts`**

วนทุกสาขาจาก `loadRegistry()` ตามลำดับ; ไม่มี `extractedPath(code)` → พิมพ์ `ข้าม <code>: ยังไม่ได้ extract` แล้วไปต่อ; ต่อสาขาพิมพ์ `<code>: เพิ่ม a, อัปเดต b, ใช้ร่วม c, เติมช่องว่าง d, เนื้อหาไม่ตรง e, ข้าม (แก้ไขผ่านเว็บแล้ว) f`; ถ้าทุกสาขาถูกข้าม → error exit 1

- [ ] **Step 6: รันกับฐานจริง**

Run: `npx prisma db seed`
Expected: บรรทัด `31901: เพิ่ม 0, …` และ `21901: เพิ่ม <n>…` ไม่มี error; เปิด `/` ยังเห็นสาขาแรก (หน้าเวอร์ชันชั่วคราวของ Task 1)

- [ ] **Step 7: รันทุกชุดแล้ว commit** — `npm test && npm run test:db` → ผ่าน; `feat: seed every registered program with shared-course rules`

---

### Task 5: หน้าสาธารณะตามสาขา ค้นหาข้ามสาขา และ export

**Files:**
- Rewrite: `app/(public)/page.tsx` (รายชื่อหลักสูตร)
- Move: `app/(public)/page.tsx` เดิม → `app/(public)/p/[code]/page.tsx`; `dashboard/page.tsx` → `p/[code]/dashboard/page.tsx`; `print/page.tsx` → `p/[code]/print/page.tsx`
- Create: `app/(public)/search/page.tsx`, `components/program-badge.tsx`
- Modify: `app/(public)/layout.tsx`, `app/layout.tsx`, `app/(public)/courses/[code]/page.tsx`, `app/api/export/route.ts`, `components/course-table.tsx`, `tests/e2e/public.spec.ts`, `tests/e2e/dashboard.spec.ts`, `tests/fixtures/sample-data.ts`, `tests/e2e/global-setup.ts`

**Interfaces:**
- Consumes: `listPrograms`, `getProgramByCode` (Task 1); `searchCourses`, `allMatchingCourses`, `getStats`, `listCategories`, `listCreditValues`, `getCourseByCode` (Task 1)
- Produces: `ProgramBadge({ program: { level: Level; name: string } })` แสดง `ปวช. <name>` / `ปวส. <name>`; `levelLabel(level: Level): "ปวช." | "ปวส."` export จาก `lib/programs.ts`

ทุกหน้าใต้ `/p/[code]` เรียก `getProgramByCode(code)` → null → `notFound()`; ลิงก์ทั้งหมดในหน้าสาขา (ตัวกรอง แบ่งหน้า ล้างตัวกรอง Excel พิมพ์ รายละเอียดวิชา `?from=<code>`) ชี้ภายใต้ `/p/<code>`; เมนูหัวเว็บ: `หลักสูตร` (`/`) เสมอ และ `สรุปภาพรวม` เฉพาะเมื่ออยู่ในสาขา; ชื่อเว็บ `ฐานข้อมูลรายวิชา หลักสูตร 2567` และหน้าในสาขาแสดง `<ระดับ> สาขาวิชา<name>` ใต้ชื่อเว็บ (หัวหน้าพิมพ์ก็ใช้ค่าจากฐานข้อมูลเช่นกัน); `<title>` ของหน้าในสาขา = `<name> (<ระดับ>) — ฐานข้อมูลรายวิชา` ผ่าน `generateMetadata`

- [ ] **Step 1: ขยาย e2e fixture** — `tests/fixtures/sample-data.ts` เพิ่มชุดข้อมูลสาขา `21901` (ปวช.) ที่มีวิชาร่วม `30000-1101` อีกหนึ่งตำแหน่ง และวิชาเฉพาะ `21900-1001`; global-setup seed ทั้งสองสาขา และสร้างวิชา `99999-0001` "วิชาไร้สาขา" ที่ไม่มีตำแหน่ง

- [ ] **Step 2: ย้าย/เขียน e2e (failing)**

ใน `tests/e2e/public.spec.ts`: เทสต์เดิมทุกตัวเปลี่ยน URL ฐานจาก `/` → `/p/31901`, `/print` → `/p/31901/print`, `/api/export` → `/api/export?program=31901&…` แล้วเพิ่ม:
```ts
test("หน้าแรกแสดงหลักสูตรแยกระดับ", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "ปวช." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ปวส." })).toBeVisible();
  await page.getByRole("link", { name: /เทคโนโลยีสารสนเทศ.*31901/ }).click();
  await expect(page).toHaveURL(/\/p\/31901$/);
});
test("ค้นหาข้ามสาขาเห็นป้ายทั้งสองสาขา", async ({ page }) => {
  await page.goto("/search?q=30000-1101");
  const row = page.getByRole("row", { name: /30000-1101/ });
  await expect(row.getByText("ปวช. เทคโนโลยีสารสนเทศ")).toBeVisible();
  await expect(row.getByText("ปวส. เทคโนโลยีสารสนเทศ")).toBeVisible();
});
test("รายละเอียดวิชาแสดงทุกสาขา และลิงก์กลับเมื่อมี from", async ({ page }) => { /* /courses/30000-1101?from=21901 → ตารางมี 2 แถว + ลิงก์ไป /p/21901 */ });
test("วิชาไร้สาขา: เจอใน /search ไม่เจอในหน้าสาขา", async ({ page }) => {
  /* /search?q=99999 → 1 แถว; /courses/99999-0001 → "ยังไม่อยู่ในหลักสูตรใด"; /p/31901?q=99999 → "ไม่พบรายวิชาที่ตรงกับเงื่อนไข" */
});
for (const path of ["/p/abc", "/p/3190", "/p/99999", "/p/99999/dashboard", "/p/99999/print"]) {
  test(`${path} → 404 ภาษาไทย`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(404);
  });
}
test("export ไม่มี program หรือรหัสไม่มีจริง → 404", async ({ request }) => {
  expect((await request.get("/api/export")).status()).toBe(404);
  expect((await request.get("/api/export?program=99999")).status()).toBe(404);
});
```
`tests/e2e/dashboard.spec.ts`: URL → `/p/31901/dashboard` ตัวเลขที่คาดยังเป็นของสาขา 31901 เท่านั้น

- [ ] **Step 3: รันให้ล้ม** — `npm run test:e2e` → เทสต์ใหม่และที่เปลี่ยน URL ล้ม

- [ ] **Step 4: ทำหน้าตาม spec หัวข้อ 5** — ย้ายไฟล์ด้วย `git mv` แล้วแก้; `/search` ใช้ `searchCourses({ ...parseFilter(sp), programId: null, categoryId: null })` และ `CourseTable` แสดงคอลัมน์ป้ายสาขาแทนคอลัมน์หมวดเมื่อ `categoryName === null`; export ใช้ `program` param → `getProgramByCode` → null = `new Response("ไม่พบหลักสูตร", { status: 404 })`; ชื่อไฟล์ `courses-<code>-<yyyymmdd>.xlsx`

- [ ] **Step 5: รันให้ผ่าน** — `npx tsc --noEmit && npm run lint && npm run test:e2e` → ผ่านทั้งหมด

- [ ] **Step 6: Commit** — `feat: per-program public pages and cross-program search`

---

### Task 6: หน้าผู้ดูแลตามสาขา

**Files:**
- Create: `app/admin/programs/page.tsx`, `app/admin/programs/actions.ts`, `components/placements-field.tsx`, `tests/db/programs.test.ts`
- Modify: `lib/programs.ts`, `lib/course-admin.ts`, `lib/validation.ts`, `components/course-form.tsx`, `app/admin/courses/{page,actions,[id]/page,new/page}.tsx`, `app/admin/categories/page.tsx`, `app/admin/page.tsx`, `app/admin/layout.tsx` (เมนู `สาขา`), `tests/db/admin-actions.test.ts`, `tests/unit/validation.test.ts`, `tests/e2e/admin.spec.ts`

**Interfaces:**
- Consumes: Task 1 `lib/programs.ts`, `lib/course-admin.ts`
- Produces:
  - `lib/validation.ts`: `programSchema` (`code` `/^\d{5}$/` ข้อความ `รหัสสาขาต้องเป็นตัวเลข 5 หลัก`, `level` PVC|PVS, `name`/`typeName` ผ่าน `normalizeThai` ไม่ว่าง ≤ 300, `sortOrder` 0–9999); `courseSchema` แทน `categoryId` ด้วย `placements: { programId: number; categoryId: number }[]` (จาก FormData ใช้คีย์ `placements.<i>.programId` / `placements.<i>.categoryId`; ฟังก์ชัน `parsePlacements(form: Record<string, unknown>)` แปลงเป็น array ก่อน parse)
  - `lib/programs.ts`: `saveProgram(id: number | null, input: unknown): Promise<ActionResult>` (แก้ไขไม่เปลี่ยน `code` แม้ส่งมา; รหัสซ้ำ → `fail("code", "รหัสสาขานี้มีอยู่แล้ว")`); `deleteProgram(id): Promise<ActionResult>` (มีตำแหน่ง N > 0 → `fail("_", "ลบไม่ได้: ยังมี N วิชาในสาขานี้")`; ไม่งั้นลบหมวดของสาขาและสาขาใน transaction)
  - `lib/course-admin.ts`: `saveCourse(id, input)` — สาขาซ้ำ → `errors["placements.<i>.programId"] = "เลือกสาขานี้ซ้ำ"`; สาขาไม่มีจริง → `errors["placements.<i>.programId"] = "ไม่พบสาขาที่เลือก"`; หมวดไม่ใช่ของสาขา → `errors["placements.<i>.categoryId"] = "หมวดนี้ไม่ได้อยู่ในสาขาที่เลือก"`; ผ่านแล้วบันทึกเนื้อหา + ลบตำแหน่งเดิมทั้งหมด + สร้างตามฟอร์ม ใน `db.$transaction`
  - `fieldErrors` ต้องใช้ path เต็ม (`issue.path.join(".")`) สำหรับ placements โดยคีย์ของช่องอื่นเหมือนเดิม
  - `PlacementsField({ programs: { id; code; level; name; categories: { id; code; name; depth }[] }[]; initial: { programId; categoryId }[]; errors: Record<string, string> })`

- [ ] **Step 1: เขียน db test (failing)**

`tests/db/programs.test.ts`:
```ts
test("สร้างและแก้สาขา แก้แล้วรหัสไม่เปลี่ยน", async () => { /* saveProgram(null, …31901) ok; saveProgram(id, {code:"11111", name:"ใหม่"}) → code ยัง 31901, name "ใหม่" */ });
test("รหัสสาขาซ้ำ", async () => { /* errors.code === "รหัสสาขานี้มีอยู่แล้ว" */ });
test("ลบสาขาที่ยังมีวิชาไม่ได้", async () => { /* 2 ตำแหน่ง → errors._ === "ลบไม่ได้: ยังมี 2 วิชาในสาขานี้" */ });
test("ลบสาขาว่างแล้วหมวดหายตาม", async () => { /* ok; db.category.count({where:{programId}}) === 0 */ });
```
`tests/db/admin-actions.test.ts` (แทนเทสต์ที่ใช้ `categoryId`):
```ts
test("บันทึกวิชาพร้อมตำแหน่งสองสาขา", async () => { /* placements 2 แถว → ok; programCourse.count === 2 */ });
test("หมวดของสาขาอื่น → error รายแถว และไม่บันทึกอะไรเลย", async () => {
  const before = await snapshot(courseId);   // course + placements
  expect(await saveCourse(courseId, input({ nameTh: "เปลี่ยน", placements: [{ programId: pvs.id, categoryId: pvcCat.id }] })))
    .toEqual({ ok: false, errors: { "placements.0.categoryId": "หมวดนี้ไม่ได้อยู่ในสาขาที่เลือก" } });
  expect(await snapshot(courseId)).toEqual(before);
});
test("สาขาซ้ำ / สาขาไม่มีจริง", async () => { /* "เลือกสาขานี้ซ้ำ" ที่แถว 1; programId 999999 → "ไม่พบสาขาที่เลือก" */ });
test("ไม่มีตำแหน่งเลยก็บันทึกได้", async () => { /* placements [] → ok; programCourse.count === 0 */ });
```
`tests/unit/validation.test.ts`: `parsePlacements({ "placements.1.programId": "2", "placements.0.programId": "1", "placements.0.categoryId": "5", "placements.1.categoryId": "6" })` → `[{programId:"1",categoryId:"5"},{programId:"2",categoryId:"6"}]` (เรียงตาม index) และ `programSchema` ปฏิเสธ `code: "3190"`

- [ ] **Step 2: รันให้ล้ม** — `npm test && npm run test:db` → เทสต์ใหม่ FAIL

- [ ] **Step 3: เขียน lib ตาม Interfaces** แล้วรันให้ผ่าน — คำสั่งเดิม → PASS

- [ ] **Step 4: เขียน e2e (failing) ใน `tests/e2e/admin.spec.ts`**

```ts
test("เพิ่มวิชาเข้าสาขาที่สอง แล้วเห็นในหน้าสาขานั้น", async ({ page }) => {
  await loginAs(page, STAFF);
  // เปิดฟอร์มวิชา 31900-0001 → "+ เพิ่มสาขา" → เลือก "ปวช. เทคโนโลยีสารสนเทศ" → หมวด "2.1 …" → บันทึก
  await page.goto("/p/21901?q=31900-0001");
  await expect(page.getByRole("link", { name: /31900-0001/ })).toBeVisible();
});
test("ฟอร์มวิชาที่ใช้ร่วมแสดงคำเตือน", async ({ page }) => { /* 30000-1101 → "เนื้อหาวิชานี้ใช้ร่วมกับ 2 สาขา แก้แล้วมีผลทุกสาขา" */ });
test("ลบแถวสาขาจนหมดแสดงคำเตือน", async ({ page }) => { /* "วิชานี้จะไม่แสดงในหน้ารายวิชาของสาขาใด" */ });
test("หน้าสาขา: ลบสาขาที่มีวิชาไม่ได้", async ({ page }) => { /* /admin/programs → ลบ 21901 → "ลบไม่ได้: ยังมี " */ });
test("หมวดแยกตามสาขา", async ({ page }) => { /* /admin/categories?program=21901 เห็นเฉพาะหมวดของ 21901 */ });
```
เทสต์ admin เดิมที่เลือกหมวดผ่าน `categoryId` ปรับให้เลือกผ่านแถวตำแหน่ง

- [ ] **Step 5: ทำหน้าตาม spec หัวข้อ 6** — `/admin/categories` ไม่มี `program` → ใช้สาขาแรก; `program` ไม่มีจริง → `notFound()`; `/admin/courses` ตัวกรอง `program` ใส่ `programId` ใน `searchCourses`; `/admin` ตารางต่อสาขา: `จำนวนวิชา`, `ต้องตรวจ` ลิงก์ไป `/admin/courses?program=<code>&review=1`; ทุก action ใหม่ใช้ `runAs(["ADMIN","STAFF"], …)` และ `revalidatePath("/", "layout")`

- [ ] **Step 6: รันทุกชุด** — `npx tsc --noEmit && npm run lint && npm test && npm run test:db && npm run test:e2e` → ผ่านทั้งหมด

- [ ] **Step 7: Commit** — `feat: manage programs and per-program placement in admin`

---

### Task 7: README และตรวจรอบสุดท้าย

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-11-12-course-database-design.md` (บรรทัดนอกขอบเขต "การรองรับหลายหลักสูตร" → ชี้ไป spec ใหม่)

- [ ] **Step 1: README** — แทนส่วน "ติดตั้งและรันครั้งแรก" ส่วนคำสั่ง extract ด้วย `npm run extract` (ทุกสาขา) และเพิ่มหัวข้อ **"เพิ่มสาขาใหม่"**: วาง PDF ใน `Data/` → เพิ่มรายการใน `Data/programs.json` (หาช่วงหน้าจากสารบัญ: หน้าแรกของโครงสร้างหลักสูตรถึงหน้าสุดท้ายของคำอธิบายรายวิชา) → `npm run extract -- <code>` → ตรวจ `<code>.report.txt` เทียบตารางโครงสร้าง → `npx prisma db seed` → อ่านบรรทัด "เนื้อหาไม่ตรง" และตรวจวิชาที่ติดธงในหน้าผู้ดูแล; อธิบายกติกาวิชาร่วมสั้น ๆ (เล่มแรกเป็นเจ้าของ เล่มหลังเติมช่องว่าง) และ URL ใหม่ (`/`, `/p/<code>`, `/search`)

- [ ] **Step 2: ตรวจครบชุดบนฐานสะอาด**

Run: `docker compose down -v && docker compose up -d --wait && npx prisma migrate deploy && npx prisma db seed && npx tsc --noEmit && npm run lint && npm test && npm run test:db && npm run test:e2e`
Expected: seed พิมพ์ทั้ง 31901 และ 21901 ไม่มี error; เทสต์ผ่านทั้งหมด

> คำสั่ง `docker compose down -v` ลบข้อมูลในฐาน `courses` ที่ใช้งาน (รวมวิชาที่แก้ผ่านเว็บ) ต้องถามผู้ใช้ก่อนรัน ถ้าไม่ได้รับอนุญาต ให้ใช้ `npx prisma migrate deploy && npx prisma db seed` กับฐานเดิมแทน

- [ ] **Step 3: เปิดเว็บจริงตรวจด้วยตา** — `npm run dev` → `/` เห็นกลุ่ม ปวช. และ ปวส. → เข้า 21901 → ค้นหา/กรอง/Excel/พิมพ์/แดชบอร์ด → เปิดวิชาที่ใช้ร่วมในระดับเดียวกัน (เช่น `21900-1001` ถ้ามีหลายสาขา ปวช.; ถ้ามีสาขาเดียวต่อระดับ ตารางจะมีหนึ่งแถว) เห็นตาราง "อยู่ในหลักสูตร" ถูกต้อง

- [ ] **Step 4: Commit** — `docs: explain adding a new program`
