import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { SCENES } from '../src/scenario/scenes';
import { STUDENT_SHOTS } from '../src/student/frame';
import { scriptFor, TEACHER_SCENES } from '../src/teacher/script';

const OUT = 'contact-sheet';
const PORT = 5199;
const verify = process.argv.includes('--verify');

async function shoot(page: Page, app: 'teacher' | 'student', scene: number, t: number): Promise<Buffer> {
  await page.goto(`http://localhost:${PORT}/${app}.html?scene=${scene}&t=${t}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return page.screenshot();
}

/** Every scripted cursor click must land on a button. Checked 1 ms before the click, since the target may vanish at the click instant. */
async function checkClicks(page: Page): Promise<string[]> {
  const failures: string[] = [];
  const vp = page.viewportSize();
  if (!vp || vp.width !== 1920 || vp.height !== 1080) throw new Error('click hit-test needs a 1920x1080 viewport (Stage is 1:1)');
  for (const scene of TEACHER_SCENES) {
    for (const k of scriptFor(scene).cursor) {
      if (!k.click) continue;
      const t = k.t - 1;
      await page.goto(`http://localhost:${PORT}/teacher.html?scene=${scene}&t=${t}&titles=0&cursor=0`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(250);
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.slice(0, 40) ?? null, [k.x, k.y]);
      if (hit === null) failures.push(`Sc${scene} t=${t}: click at (${k.x}, ${k.y}) does not land on a button`);
      else console.log(`click ok Sc${scene} t=${t} (${k.x}, ${k.y}) -> ${hit}`);
    }
  }
  return failures;
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

  const clickFailures = verify ? await checkClicks(teacher) : [];

  await browser.close();
  await server.close();
  if (clickFailures.length) {
    console.error(`Cursor clicks that miss their target:\n${clickFailures.join('\n')}`);
    process.exit(1);
  }
  if (mismatches.length) {
    console.error(`Non-deterministic frames:\n${mismatches.join('\n')}`);
    process.exit(1);
  }
  console.log(`${jobs.length} frames written to ${OUT}/${verify ? ' · all deterministic · all clicks hit a button' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
