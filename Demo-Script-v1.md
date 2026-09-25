# Orbital Rakshak — IN-SPACe Demo Script

**Framework:** Awareness → Quantify → Respond
**Audience:** IN-SPACe (non-technical + technical reviewers), Technology Adoption Fund pitch
**Build:** current `orbital-rakshak` branch — Globe, RSO Lists, Response tab
**Live time:** ~7–8 minutes, plus Q&A

This script is written to be read almost verbatim. Jargon is explained the first time
it's used, inline, in plain words — so it works for a room that mixes policy reviewers
with technical assessors. A full glossary is at the end for reference during Q&A.

Everything below uses the real seeded demo data already in this app — no setup needed
beyond opening it fresh.

---

## Before you start

- Reload the app so it's on a clean slate (nothing selected, mission clock at the demo epoch).
- Have the **Globe** tab open first.
- Know the three names you'll click, in order:
  1. **CARTOSAT-3** — an Indian imaging satellite (Awareness + Quantify: threat window)
  2. **RESOURCESAT-2A** — an Indian earth-observation satellite (Quantify + Respond: conjunction)
  3. The **Response** tab itself

---

## Opening (30 seconds — say this before touching anything)

> "Space is getting crowded — more satellites, more debris, more manoeuvring objects, and
> less time to work out what actually matters. Most operators either buy this capability
> from a handful of foreign vendors, or they don't have it at all.
>
> Orbital Rakshak is a sovereign, India-built platform that does three things, in order:
> it makes an operator **aware** of what's near their assets, it **quantifies** how
> serious that is in numbers an operator can act on, and it helps them **respond** —
> compare options, commit a plan, and generate the paperwork a regulator like IN-SPACe
> would actually want to see.
>
> One rule the whole platform follows: **Orbital Rakshak describes. People decide.**
> It never takes an action on its own, and it never claims to know who's responsible for
> something — it shows the evidence and lets the operator choose."

---

## Phase 1 — AWARENESS (~90 seconds)

**Goal:** show the shared operating picture and how objects get organised.

### Click path
1. You're on the **Globe** — this is the *operating picture*: every tracked object in
   orbit around Earth, positioned live from real orbital data.
2. Point out the **surface switcher** (top-left of the globe) — Physical, Wireframe,
   Political. Not just cosmetic — different surfaces suit different briefings (e.g.
   political borders for a sovereignty conversation).
3. Open **RSO Lists** in the top-right nav.
4. Show the three categories: **Owned**, **Allied**, **Opposed**.

### What to say
> "Every object we track is an **RSO** — a Resident Space Object. That's the standard
> term for anything catalogued in orbit: an active satellite, a dead rocket stage, a
> fragment of debris.
>
> The globe is the shared picture — where everything is, right now, at whatever
> simulation speed we're running. But a picture alone isn't useful until you tell the
> system what matters to you. That's what these lists are for: **Owned** — assets you
> operate. **Allied** — assets you'd protect on someone else's behalf. **Opposed** —
> objects you don't trust, or don't control, and want watched.
>
> This matters because Orbital Rakshak only calculates risk for **owned or allied
> objects against opposed ones**. It's not a blanket sky-full of noise — it's scoped to
> what an operator has actually told it to watch."

### Jargon check (say if the room looks technical)
- **RSO (Resident Space Object)** — any tracked object in orbit, active or dead.
- **TLE (Two-Line Element)** — the standard format for an object's orbital position data, refreshed periodically as it's re-tracked.

---

## Phase 2 — QUANTIFY (~3 minutes — the centrepiece, don't rush this)

This phase has two related but distinct ideas. Don't blur them together:

- **Threat windows** — *could* another object manoeuvre to reach mine, and how easily?
- **Conjunction windows** — *is* another object's current, unpowered trajectory going to pass close to mine?

### 2a. Threat windows — "could they reach me?"

**Click path**
1. Select **CARTOSAT-3** on the globe (or from Owned in RSO Lists).
2. In the right-hand Inspector panel, open **Threat windows**.
3. Click into the CARTOSAT-3 × **INSP-1** window (a simulated inspector satellite,
   flagged as co-planar and closing).
4. Hover the "**i**" next to the section title to show the built-in definition tooltip.
5. Point at the manoeuvre sequences list — sortable by **Δv** (cheapest), **Duration**
   (quickest), **End** (soonest arrival).

**What to say**
> "This is the question that actually matters to an operator: *if someone wanted to
> reach my satellite, how many ways could they do it, how cheap would it be, and how
> soon?*
>
> INSP-1 here is a simulated object flagged as co-planar with CARTOSAT-3 — same orbital
> plane, sitting slightly lower and behind it. The system has worked out every
> physically feasible manoeuvre sequence — a **burn-coast-burn** transfer, meaning one
> engine firing, a coast phase, then a second firing to arrive — that could close that
> gap.
>
> Each option is scored on **delta-v** — that's the standard unit for how much
> propulsive effort a manoeuvre costs, roughly 'how much fuel and thrust it takes to
> change your orbit by this much.' Lower delta-v means an easier, more likely move.
>
> We can sort these by cheapest, quickest, or soonest-arriving — because those are three
> different ways an adversary or a curious neighbour might prioritise a rendezvous."

### 2b. Threat rating — the aggregate score

**Click path**
1. Tap the big rating number at the top of the threat window card ("tap to explain").
2. Walk through the breakdown modal: **cheap / quick / soon**, each weighted, summing to one 0–100 number.

**What to say**
> "Rather than making an operator read six numbers per window, we collapse it into one
> **Threat Rating**, 0 to 100 — a weighted mean of how cheap the cheapest option is, how
> quick the quickest is, and how soon the soonest arrives. Every window that's still
> open for an object rolls up into that object's rating. Tap it, and it shows you
> exactly how that number was built — nothing is a black box here."

### 2c. Conjunction windows — "are we on a collision course right now?"

**Click path**
1. Deselect, then select **RESOURCESAT-2A**.
2. Open **Conjunction windows** in the Inspector, click into the top entry (paired with **SL-16 R/B**, a derelict Russian rocket stage).
3. Point at the severity badge, then open **Severity breakdown**.
4. Open **Screening history** — show the four successive screenings tightening.

**What to say**
> "This is a different question: not 'could someone reach me,' but 'is something
> already on a path that brings it dangerously close to me, with no one steering it?'
>
> SL-16 R/B is a derelict rocket body — 9 tonnes, non-manoeuvrable. It cannot get out of
> the way. If anyone avoids this, it has to be RESOURCESAT-2A.
>
> The **Conjunction Severity Index**, or CSI, is the 0–100 number at the top — built the
> same way as the Threat Rating conceptually, but from three different, industry-
> standard inputs: **Pc**, the probability of collision; **miss distance**, how close
> the two objects' predicted paths actually come; and **time to TCA** — Time of Closest
> Approach, the exact moment the two objects are nearest each other. The closer, more
> probable, and more imminent it is, the higher the score.
>
> And this isn't a one-off calculation — look at the screening history. Four
> successive assessments over the last two days, and the miss distance has tightened
> from 890 metres down to 142. That's the kind of trend an operator needs to see, not
> just a single snapshot."

### Jargon check
- **Δv (delta-v)** — the standard measure of manoeuvre cost: change in velocity, driven by fuel and thrust.
- **Pc (probability of collision)** — the statistical chance of an actual collision, given both objects' position uncertainty.
- **TCA (Time of Closest Approach)** — the precise moment two objects are nearest each other along their predicted paths.
- **CSI (Conjunction Severity Index)** — Orbital Rakshak's own 0–100 composite of Pc, miss distance, and time-to-TCA.
- **Screening radius** — the distance threshold used to decide whether a pair even counts as a conjunction worth tracking.

---

## Phase 3 — RESPOND (~2 minutes)

**Goal:** show that once a risk is quantified, the operator gets real options — and stays firmly in control of what happens next.

### Click path
1. Click the **Response** tab in the top nav — the queue of every conjunction with a workable option, sorted by severity. RESOURCESAT-2A × SL-16 R/B should be at the top.
2. Click into it.
3. Walk the three **course of action (COA)** cards — point at delta-v cost, % of fuel budget used, decision-lead time, and predicted post-manoeuvre miss distance / Pc.
4. Point at the **Recommended** badge on one of them.
5. Select a COA, click **Execute COLA burn plan** — show the confirmation dialog with the exact burn times.
6. Point at the line: **"Demo only: no command is sent to any spacecraft."**
7. Click **Commit**, then **Generate IN-SPACe NGP filing**.
8. Show the exported document — pre-submission checks, and the two real industry-
   standard export formats: **CCSDS OEM** (the resulting orbit after the manoeuvre) and
   **CCSDS OCM** (a summary of the manoeuvre itself).

### What to say
> "So we've quantified the risk. The Response tab is where an operator acts on it.
>
> Every option here is a genuine, physically feasible **course of action** — a COA —
> not a guess. Each shows what it costs in delta-v, what share of that satellite's
> remaining fuel budget that represents, how long the operator has before they need to
> decide, and — critically — what the miss distance and collision probability look like
> *after* the manoeuvre. The system recommends one, but the operator picks.
>
> When they commit, notice exactly what it says: **'Demo only — no command is sent to
> any spacecraft.'** That's not a caveat we're hiding. It's the whole design principle.
> Orbital Rakshak will never be the thing that fires a thruster. It's the thing that
> makes sure a human fires it well-informed.
>
> And once a plan is committed, we generate the compliance filing — using **CCSDS**
> formats, the actual international standard for exchanging spacecraft ephemeris and
> manoeuvre data, the same formats operators and regulators already use worldwide. This
> is a direct answer to a real IN-SPACe requirement: post-manoeuvre reporting. Right now
> that's a manual, multi-day process for most operators. Here it's generated the moment
> the decision is made."

---

## Closing (30 seconds)

> "So in one workflow: we go from a shared picture of everything in orbit, to a
> precise, auditable number for how much risk any one object represents, to a
> defensible, human-approved response and the compliance paperwork that goes with it.
>
> That whole chain — describe, quantify, decide — is what we're asking the ₹24 crore
> Technology Adoption Fund to help us take from this working prototype to a
> production-grade, India-sovereign platform: reducing dependence on foreign SSA
> vendors, and giving Indian operators and IN-SPACe a common, homegrown source of
> truth for space safety."

---

## If something lags or breaks mid-demo

> "While that loads — the point isn't any single screen, it's the workflow: awareness,
> quantified into a decision, turned into an auditable action. Every number on every
> screen you've seen is explained if you tap or hover it — nothing here is a black box."

---

## Anticipated questions

- **"Is any of this real orbital data?"** — The seeded scenarios are illustrative
  (built for this demo), but the platform is designed against real TLE feeds and
  standard orbital mechanics; the computation, not the demo dataset, is what scales to
  production.
- **"Does it ever act automatically?"** — No. Every commit is a human decision.
  Orbital Rakshak's job stops at presenting the option and drafting the paperwork.
- **"What stops it being wrong?"** — Every score is decomposable — tap it and see the
  exact inputs and weights. Nothing is a single opaque model output.
- **"What's next after this MVP?"** — Manoeuvre detection (spotting when an opposed
  object has already fired its engines, not just modelling if it could), alert
  fan-out (email/SMS/webhook), and broader regulatory-artefact automation beyond the
  post-manoeuvre filing shown today.

---

## Glossary (quick reference)

| Term | Plain-English meaning |
| --- | --- |
| RSO | Resident Space Object — anything tracked in orbit: satellite, rocket body, debris. |
| TLE | Two-Line Element — the standard format for an object's tracked orbital position. |
| Owned / Allied / Opposed | Orbital Rakshak's operator-defined categories: what you run, what you protect, what you watch. |
| Threat window | A calculated period during which an opposed object could feasibly manoeuvre to reach an owned/allied one. |
| Manoeuvre / intercept sequence | A specific burn-coast-burn plan that achieves a rendezvous or approach. |
| Δv (delta-v) | The standard unit of manoeuvre cost — how much velocity change (and therefore fuel) a burn requires. |
| Threat Rating | Orbital Rakshak's 0–100 score for a threat window: weighted mean of cheapest Δv, quickest transit, soonest arrival. |
| Conjunction | A predicted close approach between two objects' current, unpowered trajectories. |
| Pc | Probability of collision — statistical chance of impact, from both objects' position and uncertainty. |
| TCA | Time of Closest Approach — the exact moment two objects are nearest each other. |
| Miss distance | The predicted separation between two objects at TCA. |
| CSI | Conjunction Severity Index — Orbital Rakshak's 0–100 score for a conjunction: weighted mean of Pc, miss distance and time-to-TCA. |
| Screening radius | The distance threshold used to decide whether a pair is tracked as a conjunction at all. |
| COA | Course of Action — one candidate response plan to a conjunction, with its own cost/benefit metrics. |
| COLA | Collision Avoidance — the general term for a manoeuvre performed specifically to avoid a predicted conjunction. |
| Manoeuvre envelope | The propulsion limits (remaining Δv, thrust, mass, specific impulse) used to test whether a COA is physically feasible for that object. |
| CCSDS OEM | Orbit Ephemeris Message — the international standard format describing an object's state (position/velocity) over time, here the post-manoeuvre orbit. |
| CCSDS OCM | Orbit Comprehensive Message — the international standard format summarising a manoeuvre plan itself. |
| NGP filing | The IN-SPACe post-manoeuvre compliance report Orbital Rakshak drafts once a plan is committed — a demo output, not an official filing. |
| Threat log | The running history of rating changes for an object — every reassessment, in order, with what changed and why. |
