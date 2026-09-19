# Moonline Express

## Summary

Moonline Express is a five-minute arcade routing game for the Nexus Arcade cabinet. The player is the midnight station controller. Each train carries a destination lamp; the player changes four junctions so trains arrive on the correct platform without colliding or overloading the station.

## Outcome

The first prototype establishes a complete, launchable loop:

- title screen and clear onboarding;
- four readable junctions with three routing states;
- trains with visible destination targets;
- correct delivery scoring and escalating combo;
- wrong-platform and collision damage;
- station-health failure and five-minute completion;
- keyboard, touch, and cabinet-friendly button controls;
- pause, restart, responsive layout, and no external runtime dependencies.

The prototype is intentionally self-contained so it can be tested in the public catalog without a build step or network dependency.

## TODO

1. Add a short sound pass: bell for delivery, clack for switching, warning pulse for collisions.
2. Add a proper cabinet cover image and a small catalog thumbnail.
3. Tune the spawn curve with playtest evidence from three full sessions.
4. Add a deterministic seeded mode for replay and automated score comparisons.
5. Add a station-event layer: express trains, maintenance closures, and bonus routes.
6. Add a dedicated browser smoke scenario covering start, junction changes, scoring, pause, and gameover.
7. Evaluate a NexusEngine-backed composition after the game rules stabilize.

## Acceptance checks

- A new player can start a shift and understand the destination lamp without reading external documentation.
- Every junction can be changed by both keyboard and touch.
- At least one correct delivery increases score and combo.
- A wrong delivery or collision visibly reduces station health.
- Pause freezes the simulation and resume continues it.
- The game reaches a visible result state without uncaught browser errors.
- The prototype passes the repository build and registry validation.
