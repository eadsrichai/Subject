import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { loadRegistry } from "../../lib/program-registry";

const e = (code: string) => ({
  code,
  level: "PVS",
  name: "เทคโนโลยีสารสนเทศ",
  typeName: "อุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ",
  pdf: "x.pdf",
  pages: [1, 2],
});

function tmpRaw(text: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-"));
  const file = path.join(dir, "programs.json");
  fs.writeFileSync(file, text);
  return file;
}
const tmp = (entries: unknown[]) => tmpRaw(JSON.stringify(entries));

test("อ่านไฟล์จริงได้และเรียงตามไฟล์", () =>
  expect(loadRegistry().map((p) => p.code)).toEqual(["31901", "21901"]));
test("รหัสซ้ำ", () => expect(() => loadRegistry(tmp([e("31901"), e("31901")]))).toThrow(/ซ้ำ.*31901/));
test("ระดับผิด", () => expect(() => loadRegistry(tmp([{ ...e("1"), level: "BBA" }]))).toThrow(/\[0\]\.level/));
test("ช่วงหน้ากลับด้าน", () =>
  expect(() => loadRegistry(tmp([{ ...e("31901"), pages: [50, 10] }]))).toThrow(/\[0\]\.pages/));
test("ไม่ใช่ JSON", () => expect(() => loadRegistry(tmpRaw("{"))).toThrow(/programs\.json/));
