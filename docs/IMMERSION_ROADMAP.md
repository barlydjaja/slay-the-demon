# The Last Hope — a world worth returning to

Design and implementation roadmap · 12 September 2026

## The promise

A small machine inherits an enormous responsibility. The player explores a frightening, beautiful world, learns to survive it, and brings something valuable home. Human voices, repaired places, and visible signs of life make “humanity’s last hope” a responsibility the player can feel.

The browser should make the game easy to enter. It should not limit the care given to combat, atmosphere, consequences, or the player's time. Everything remains local during development; publishing is not part of this roadmap.

## What makes time here worthwhile

- **A home that remembers you.** Firstlight changes after specific deeds. People have names, relationships, needs, and responses to what happened.
- **Curiosity pays off.** A distant silhouette, sound, trail of flowers, or unfamiliar light leads to a discovery with a story or useful reward.
- **Growth changes play.** Upgrades open tactical choices and routes. Repeated chores and inflated enemy health do not stand in for progression.
- **Tension has breathing room.** Combat, travel, discovery, and moments of quiet alternate. Safe places are reliably safe.
- **Leaving is comfortable.** Clear saving, nearby retries, skippable/revisitable conversations, and a journal respect short browser sessions. No daily streaks, scarcity timers, or pressure to keep playing.

A typical excursion should offer a destination, a choice on the way, one encounter worth learning, and something meaningful to bring home. Approximate play times below are design targets to validate with players, not measured promises.

## Session rhythm

| Timescale                          | Desired experience                                       | Example                                                                               |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| First minute                       | Understand who you are, what you can do, and where to go | A small blue machine follows a warm light through the rain.                           |
| Every 30–90 seconds of exploration | Notice a new detail, landmark, interaction, or decision  | Bluebells turn off the main path toward an abandoned cart.                            |
| Every 3–6 minutes                  | Finish a small discovery or encounter                    | Recover a named component and hear the memory it carries.                             |
| Every 10–20 minutes                | Return with a lasting change                             | Restore the mill; see its sails turn and the village gather.                          |
| Across sessions                    | Recognize progress and anticipate a new possibility      | Continue at Firstlight with recovered parts, defeated creatures, and upgrades intact. |

Distances and encounter density must be judged through play. Do not extend travel merely to meet a time target. Preserve quiet vistas and optional detours.

## Ordered implementation plan

Each stage must become playable, visually reviewed, and tested before the next stage starts. Build shared systems only when an actual stage uses them.

| Order | Expansion                                           | Player-facing payoff                                                                                                           | Completion gate                                                                                                         |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1     | **Firstlight restoration: A Light to Come Home To** | A named villager, two recoverable parts, a remembered human voice, a repaired mill, a persistent energy upgrade, and a journal | Complete the quest in either collection order; see and hear the village change; reload and continue correctly.          |
| 2     | **Three robot disciplines**                         | Stormblade chains electricity; Bulwark stores parry energy; Wispkeeper directs support drones                                  | Each has one useful active ability and a tradeoff; players can switch at the well without grinding.                     |
| 3     | **The Rootbound City**                              | A compact forest threaded through a ruined city, with hills, bridges, waterways, caves, and a new destination                  | Three connected routes, one optional shortcut, reliable terrain/collision, two discoveries, and one finished encounter. |
| 4     | **The memory archive**                              | Recover personal memories from broken machines; unlock contextual dialogue and one secret route                                | Three distinct vignettes; optional reading; journal replay; no mandatory exposition dump.                               |
| 5     | **A living village**                                | A rescued smith opens a workshop, a farmer plants recovered seeds, a child recognizes the robot                                | Three meaningful restoration states, modest NPC routines, and visible responses to player deeds.                        |
| 6     | **Recognizable monster behavior**                   | Wolves flank, spiders ambush from readable perches, guardians protect weaker enemies                                           | Clear tells, recoveries, sound cues, counterplay, and no attacks from unreadable off-screen positions.                  |
| 7     | **Night beyond the lanterns**                       | Night flowers, changed routes, rare encounters, and the comfort of returning to a lit village                                  | Rest advances time; essential quests remain available; darkness never removes attack readability.                       |
| 8     | **A companion that remembers**                      | A damaged birdlike drone rides on the robot, notices secrets, and recognizes the old city                                      | One rescue, shoulder/perch/follow states, one useful clue behavior, and no collision obstruction.                       |
| 9     | **Arena-changing bosses**                           | A cathedral beast breaks pillars; a drowned knight redirects water; a walking bell tower becomes a climbable encounter         | Build one boss at a time; changes affect decisions, maintain escape paths, and reset completely on retry.               |
| 10    | **The world restored**                              | Revisit the castle in sunlight, with plants and people occupying former battlegrounds                                          | Persistent before/after states, revised sound and dialogue, a final human moment, and optional exploration afterward.   |

**Execution status:** Stage 1 implemented and locally verified. Stage 2 is next. Stages 2–10 are ordered follow-ups, not implemented features.

## Stage 1: A Light to Come Home To

### Opening

The mill stands still when the player reaches Firstlight. Mara waits near the well. She remembers the sound of it turning because it meant her family could make bread. Her request is practical and personal: recover a copper winding from an abandoned cart by the pond and a sunwheel from the western ruins.

The quest works even if the player explores first and brings a part back before meeting Mara. The two parts can be recovered in either order. Nearby threats create tension, but no arbitrary kill counter gates a component. Recovery is deliberate with E; it does not trap the player in dialogue during combat.

### The excursion

- **Copper winding:** east bank of the pond, beside an old supply cart. A small warm light and a short descriptive interaction distinguish the component from scenery.
- **Sunwheel:** beneath the western ruined arch, within reach of the existing shrine encounters. Its discovery includes a brief fragment of an old millkeeper's voice.
- **Navigation:** Mara gives landmark-based directions; the journal retains them. Nearby interaction prompts help with precision. Neither a full map nor a trail of mandatory floating arrows is needed for this stage.
- **Discovery feedback:** the component disappears, a brief original sound plays, a journal entry changes, and the objective updates. No loot explosion or inventory sorting.

### Homecoming

Return to Mara with both components. A final conversation commits the repair once. The windmill starts slowly, fresh supplies appear, a flower bed fills out, warm lights come on, and a child gathers near the square. Mara and the child's dialogue acknowledge the change.

The reward is the **Firstlight Capacitor: +20 maximum energy**, shown in the journal and reflected in the actual stamina bar. It survives death and reload, cannot be awarded twice, and does not change baseline damage or trivialize every encounter.

### A returnable browser journey

A versioned local save starts at the Greenfields chapter. It stores the sanctuary reached, elder conversation flags, collected parts, restored mill, and defeated field creature IDs. Continue returns the player to the last safe field checkpoint with full health. Do not save a position in a hazard or midway through a conversation.

Saving is event-driven. Storage failures leave the game playable and clearly say that progress is session-only. Malformed data is validated; unsupported newer saves are preserved. Developer inspection routes must not overwrite the player's normal save. Settings use their existing separate key.

Castle progress before reaching the Greenfields remains session-local in this first stage. Extending saves to castle checkpoints belongs in a follow-up before lengthening Chapter I. Saves are browser/origin-specific; cloud sync is not included.

### Journal

J opens a compact journal and pauses gameplay. A visible “World paused” label makes this intentional reading pause explicit. It names the current quest, describes known destinations, records recovered parts and the millkeeper memory, and explains the earned upgrade. E and click advance conversations; Escape leaves or closes the journal. A visible button provides an alternative to the shortcut.

### Acceptance checks

- Reach Mara and both components without clipping or blocked paths; all art rests on the exported Blender terrain.
- Pick up parts before accepting, in either order, and after dying; never duplicate a pickup or reward.
- Opening/closing dialogue or journal does not allow hidden combat damage or leave movement held down.
- The unrepaired mill is stationary; the repaired mill visibly turns without snapping on resume.
- Restored props and character placement do not obstruct the well, paths, or village entrance.
- The capacitor changes the real energy limit; regeneration, well healing, retry, and save restoration respect it.
- Persist accepted/partially collected/completed states, elder flags, sanctuary, and defeated monsters. Reload into a safe location.
- No save writes from inspection URLs; no repeated per-frame storage writes; malformed/unavailable storage cannot crash loading.
- Inspect the village before/after, the pickup locations, journal, dialogue, and Continue in the actual browser; run the build and relevant tests.

## Art, sound, and interaction direction

Keep the hand-crafted Blender silhouettes and painted surfaces. The castle's cold stone and severe shadows should make Firstlight's timber, green slopes, warm metal, and human scale feel welcoming. New physical props and creatures are authored in Blender and retained as editable sources; UI, light, particles, and magical effects may use lightweight code geometry.

Give every area a foreground, a middle-distance landmark, and an enticing far silhouette. Add height through paths and architecture as well as terrain. A few distinctive objects do more for place identity than uniform scatter density. NPCs must face plausible activity and keep their feet grounded.

Use restrained original audio motifs: a human settlement has a gentle harmonic identity, discoveries a small recognizable phrase, and dangerous creatures directional warning sounds. Music should leave space for wind, footsteps, machinery, and silence. Text remains readable without audio. Long-form voice acting is deferred until the writing and timing are tested.

Interactions should be deliberate and consistent. E prioritizes the closest available relevant target; an eligible NPC should not be hidden by the well prompt. Highlight interactable objects through placement, silhouette, light, and a nearby prompt. Avoid covering combat with tutorials or quest panels.

## Browser delivery and performance guardrails

These are budgets to profile, not performance claims:

- Load one major map at a time; release outgoing map geometry, textures, reflection targets, and shadows.
- Keep Stage 1's incremental GLB below 0.5 MB, add no texture download, and reuse existing village art wherever appropriate.
- Share geometry/materials, instance repeated props, pool effects, and avoid new shadow-casting point lights.
- Target 60 FPS on a capable desktop and a readable reduced-quality mode on slower devices; record device, renderer, viewport, quality, and sustained frame behavior when measuring.
- Keep input responsive while loading; show honest progress and activity. Never invent a percentage from a timer.
- Freeze simulation during pause, journal, and conversations; respect reduced-motion preferences in UI animation.
- Preserve clear attack colors and silhouettes in fog, nighttime, and low settings. Test keyboard focus, readable type, and narrow desktop windows.
- No accounts, external asset services, analytics, multiplayer, crafting economy, or remote deployment are required for these stages.

## How to decide whether it is immersive

After each stage, observe a short fresh play session. Can the player explain where they want to go, name someone they care about, describe a decision they made, and point to a visible consequence? Do they voluntarily inspect something off the main path? Do they know their progress is saved and feel comfortable leaving?

Track observations, not invented retention numbers. If players feel lost, improve landmarks and journal phrasing. If travel feels empty, add a decision or discovery rather than simply more vegetation. If combat feels unfair, fix tells and collision before adding attacks. If returning home feels identical, deepen the consequence before building another map.

## Implementation record · Stage 1

Delivered on 12 September 2026:

- Mara’s recover-and-restore quest, with early exploration, either collection order, cancellable conversations, and a one-time reward.
- Two original Blender components, editable library, runtime GLB, geometry manifest, and reviewed Cycles renders. Existing village props are reused for the repaired state.
- Stationary-to-turning windmill, distance-faded timber creaks, new flowers/supplies/lanterns, Pip’s changed location and dialogue, and NPCs facing the nearby robot.
- Journal with directions, recovered component checks, the millkeeper’s written memory, and the installed capacitor. Reading pauses the world; J, Escape, or the return button resumes it.
- Maximum energy 120 after repair, including regeneration, well restoration, retry, and saved chapter reconstruction.
- Validated, event-driven Greenfields saves; safe checkpoint continuation; separate new-journey confirmation; storage failure feedback; isolated development previews.

Verification: **49 automated tests pass**. The build type-checks and produces a production bundle. New tests exercise collection order, invalid/duplicate data, reward idempotence, unavailable/quota-limited storage, future-version preservation, actual saved chapter reconstruction, retry, upgraded regeneration, restored village access, and preview isolation. Both Blender studio renders were visually reviewed. Browser checks covered Mara’s full acceptance/turn-in dialogue, both component interactions, the recovered memory, the journal, and the visible 120-energy reward. Save continuation is covered by the real chapter-loading orchestration under a headless harness; a fresh browser journey through the boss and a subsequent persisted-menu reload remains a manual release check.

The new library is below the 0.5 MB budget. Sustained frame-rate profiling, cross-browser storage checks, fresh-player quest timing, and subjective audio balance remain release/playtest work. The implementation does not establish retention metrics or prove that every player will find the experience immersive.

### Next implementation: three robot disciplines

Start with a free choice at Firstlight’s well after the capacitor is installed. Explain each discipline in one sentence, show its active ability and energy cost, and allow free switching at the sanctuary. Persist the choice; use one consistent ability key and a readable cooldown/energy indicator.

- **Stormblade:** a short lightning strike jumps through nearby enemies. Strong against groups; limited reach and a meaningful energy cost leave the robot exposed if mistimed.
- **Bulwark:** a well-timed guard stores a charge for a defensive shockwave. Rewards reading attacks; ordinary blocking alone cannot generate unlimited charge.
- **Wispkeeper:** a small support wisp briefly distracts or marks a target. Helps control dangerous encounters; a cooldown prevents permanent distraction. Physical drone art is authored in Blender when this version needs a visible machine.

Implement the choice/save foundation and one discipline at a time, then compare all three against the same field encounter. Verify cooldowns, single-hit accounting, safe-zone behavior, death/reset, journal pause, saved choice, and no free energy from switching. Keep the unmodified sword, guard, and dodge usable. Do not start the Rootbound City until each discipline offers an understandable, distinct decision and the first-time selection flow is reviewed.
