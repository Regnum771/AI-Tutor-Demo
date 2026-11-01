# Quiz Attempts, Navigation and Review: Design

Date: 2026-11-01. Status: awaiting user review. Builds on the live booth app and the student learning loop, both on `main`.

## 1. Goal

Practice on the phone keeps every try, lets the student move freely between questions, and ends on a review. Today a student must answer each question correctly before Next appears, only the last wrong choice is remembered, and the session ends straight back on Today, the plan or the progress screen.

### Decisions

| Topic | Decision |
|---|---|
| Where answers live | In the server's `PhoneState`, synced like every other tap |
| Moving | Free: back, forward, skip, and jump by question dot |
| Re-answering | Allowed after going back; logged, never earns more credit |
| Mastery credit | By try: 1st +30%, 2nd +15%, 3rd +5%, later +0 of the gap toward 0.9 |
| Review | Every session ends on it; a mastery check then shows the progress screen |
| Scripted video | Not a constraint for this work |

## 2. Data

`PhoneState` replaces `hinted`, `result` and `lastOption` with an answer sheet for the open session:

```ts
interface QuestionSheet {
  itemId: string;
  /** Options tapped, in order. A repeat of the option just tapped is not added. */
  tries: number[];
  /** The try number of the first correct answer, or null until there is one. */
  rightOn: number | null;
  /** True after Answer again: the options are cleared until the next tap. */
  reopened: boolean;
}

PhoneState.sheet: QuestionSheet[];   // one entry per question slot opened so far
PhoneState.item: number;             // the slot on screen (unchanged)
PhoneState.screen: … | 'review';     // new screen
```

- A teacher session fills `sheet` with every item of the session when it opens.
- A self session adds an entry the first time a slot is opened. `SelfSession.served` stays the list of chosen item ids, and its order matches `sheet`.
- `Attempt` in the study record gains `tries: number`, the try that was right (1 for first try). `firstTry` stays and means `tries === 1`.
- `Evidence` text for an answer reads `correct on try N` or `chose <option>`. The `result` marker added for the progress screen stays.

## 3. Rules (pure, in `src/live/mastery.ts` and `src/live/study/record.ts`)

- **Credit:** `gainFor(tryNumber)` returns 0.30, 0.15, 0.05, then 0. A correct answer moves the concept that fraction of the way toward 0.9. Only the first correct answer for a question earns credit; a re-answer after Answer again earns nothing. A wrong answer leaves mastery alone. This applies to teacher sessions and self practice alike, replacing `afterAnswer`'s hinted flag.
- **Bloom level (self practice):** two first-try correct answers in a row move the CLO's level up; a wrong answer moves it down. Re-answers count for neither.
- **Minutes:** each try logs 1.5 minutes as today; a repeat tap of the same option logs nothing.
- **Attempts:** one `Attempt` per question, written at its first correct answer, with `tries`. Wrong taps before it are counted in `tries`, not logged as separate attempts. Each wrong tap still writes its evidence row, as today.

## 4. Phone flow

- **Practice screen:** above the question, a row of numbered dots: grey before any try, outlined after a try, green once right. Back and Next sit below the options and are always available within the session (Back hidden on the first question).
- **Tapping a dot** opens that question. In self practice, opening an empty slot by Next or by its dot picks the question then with the existing adaptive rule; it stays fixed after that.
- **An answered question** shows the chosen option marked correct and "Correct on try 2", with an **Answer again** link that clears the options for a fresh choice.
- **An open question** keeps its tried options marked "Not quite" and shows the hint for the last wrong choice.
- **Finish** shows on the last question. When every question has a right answer it opens the review; otherwise it reads "2 questions left" and jumps to the first open one.
- **Worked steps** (`guided`) still appear after a correct answer.

**Review screen** (`screen: 'review'`)
- Summary line: "5 questions · 3 right first try · 9 tries in all".
- One row per question: the prompt, the tries in order (✗ q → p, then ✓ ¬q → ¬p), and the right answer.
- Tapping a row expands it: the worked steps where the item has them, and the hint for each wrong option the student chose (the item has no separate explanation of the right answer).
- **Continue:** self practice → Today; a teacher session → the plan; a mastery check → the existing progress screen. The session's completion (marking the session done, adapt after a mastery check) happens when Finish opens the review, as it does today on the last Next.

## 5. Server

New routes, each a pure reducer wrapped by `DemoSession` as today:

| Route | Reducer | Does |
|---|---|---|
| `POST /api/phone/goto { item }` | `phoneGoto(state, item)` | Opens a slot; in self practice picks the question for an empty slot |
| `POST /api/phone/again` | `phoneAgain(state)` | Reopens the current right question |
| `POST /api/phone/finish` | `phoneFinish(state)` | Opens the review, or moves to the first open question |
| `POST /api/phone/continue` | `phoneContinue(state)` | Leaves the review for Today, the plan or progress |

`phoneAnswer` records the try on the sheet. `phoneNext` becomes "go to the next slot" (`phoneGoto(item + 1)`). `deliver`, `advance` and the other existing transitions that end practice clear `sheet`.

## 6. Errors

- `goto` fails for a slot outside the session or with no session open. In self practice the session holds `SELF_SESSION` slots.
- `again` fails unless the current question has a right answer.
- `finish` never fails inside a session: with open questions it moves to the first.
- A repeat tap of the option just tried still fails, as today.
- The phone's tap latch and ignored failed replies stay as they are. A teacher plan arriving mid-session still interrupts; Next day closes an open session without a review, keeping the credit already earned.

## 7. Teacher and agents

- The progress screen's accuracy counts questions right on try 1, over all questions.
- Agents read the new evidence text. `get_exam_outlook` and `get_student` add `averageTries` over the last 7 days of attempts.
- The teacher's Road to the exam panel shows "1.6 tries per question this week".

## 8. Testing

- **Rules:** credit by try, no credit for re-answers, Bloom moves on first answers only, a repeat tap counts once and logs no minutes.
- **Reducers:** the sheet survives going back and forth; a skipped self-practice slot picks one question and keeps it; Finish with open questions moves to the first; Finish opens the review and completes the session; Continue goes to the right screen for each session kind; a teacher plan arriving and Next day both clear the sheet.
- **Phone:** dot states, Answer again, Finish's two labels, and review rows with tries in order. The click audit covers the new buttons.
- **Eval:** re-run L4.1, L4.2 and L4.4 against the real API (about $0.15); L4.2's numbers may change because a third try now earns less. Update graders only where they assumed the old credit.

## 9. Out of scope

Re-opening an old review later, timers, shuffling options, and keeping the scripted video unchanged.
