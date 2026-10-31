import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { SCENES } from '../src/scenario/scenes';
import { STUDENT_SHOTS } from '../src/student/frame';

const OUT = 'contact-sheet';
const PORT = 5199;
const verify = process.argv.includes('--verify');

async function shoot(page: Page, app: 'teacher' | 'student', scene: number, t: number): Promise<Buffer> {
  await page.goto(`http://localhost:${PORT}/${app}.html?scene=${scene}&t=${t}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page.screenshot();
}

async function main() {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  const teacher = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  await mkdir(OUT, { recursive: true });

  const jobs: { page: Page; app: 'teacher' | 'student'; scene: number; t: number }[] = [];
  for (const s of SCENES) {
    for (const t of s.shots) jobs.push({ page: teacher, app: 'teacher', scene: s.id, t });
    for (const t of STUDENT_SHOTS[s.id] ?? []) jobs.push({ page: phone, app: 'student', scene: s.id, t });
  }

  const mismatches: string[] = [];
  for (const j of jobs) {
    const name = `${OUT}/${j.app}-sc${String(j.scene).padStart(2, '0')}-t${String(j.t).padStart(5, '0')}.png`;
    const first = await shoot(j.page, j.app, j.scene, j.t);
    await writeFile(name, first);
    if (verify) {
      const second = await shoot(j.page, j.app, j.scene, j.t);
      if (!first.equals(second)) mismatches.push(name);
    }
    console.log(name);
  }

  await browser.close();
  await server.close();
  if (mismatches.length) {
    console.error(`Non-deterministic frames:\n${mismatches.join('\n')}`);
    process.exit(1);
  }
  console.log(`${jobs.length} frames written to ${OUT}/${verify ? ' · all deterministic' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
