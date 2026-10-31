import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright';
import { createServer } from 'vite';
import { Q1, SC9 } from '../src/scenario/practice';
import { SCENES } from '../src/scenario/scenes';
import { STUDENT_SHOTS } from '../src/student/frame';
import { OPTION_STEP, OPTION_TOP } from '../src/student/screens/PracticeScreen';
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

/** Each scripted practice tap must sit on the centre of its option (within 2px). */
async function checkTaps(page: Page): Promise<string[]> {
  const vp = page.viewportSize();
  if (!vp || vp.width !== 390 || vp.height !== 844) throw new Error('tap check needs a 390x844 viewport (Stage is 1:1)');
  await page.goto(`http://localhost:${PORT}/student.html?scene=7&t=${SC9.pickWrong}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const centres = await page.evaluate(() =>
    [...document.querySelectorAll('[data-option]')].map((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; }),
  );
  const failures: string[] = [];
  for (const i of [Q1.chosenWrong, Q1.correct]) {
    const want = OPTION_TOP + i * OPTION_STEP;
    const got = centres[i];
    if (got === undefined || Math.abs(got - want) > 2) failures.push(`Sc7 tap on option ${i} at y=${want}, option centre is ${got === undefined ? 'missing' : got.toFixed(1)}`);
    else console.log(`tap ok Sc7 option ${i} y=${want}`);
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

  const clickFailures = verify ? [...(await checkClicks(teacher)), ...(await checkTaps(phone))] : [];

  await browser.close();
  await server.close();
  if (clickFailures.length) {
    console.error(`Scripted clicks or taps that miss their target:\n${clickFailures.join('\n')}`);
    process.exit(1);
  }
  if (mismatches.length) {
    console.error(`Non-deterministic frames:\n${mismatches.join('\n')}`);
    process.exit(1);
  }
  console.log(`${jobs.length} frames written to ${OUT}/${verify ? ' · all deterministic · all clicks and taps on target' : ''}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
