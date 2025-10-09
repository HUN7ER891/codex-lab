# Runway Rush Frontend

This folder now contains a browser-based tower control game inspired by classic airport management titles.

## Getting started

1. Open `index.html` in a modern browser. No build step is required.
2. Click **Start new shift** to begin a timed three-minute session.
3. Click an aircraft to select it, then issue commands with the keyboard (`L` to land, `H` to hold) or the sidebar buttons.

## Gameplay overview

- Aircraft spawn at the edges of the radar scope and fly toward a single runway.
- The approach fix supports a holding pattern. If the runway is unavailable, aircraft re-enter the hold.
- Clear aircraft to land when the runway status indicator shows **Clear**. Once vacated, they award points based on their size class.
- Maintain separation to avoid collisions; three strikes or a major loss of separation ends the shift early.
- Survive the full three-minute window with fewer than three strikes to complete the shift.
- The ATC log in the sidebar chronicles clearances, warnings, and runway availability so you can review recent events.

Feel free to replace the static assets with a full framework build if you want to grow the prototype into a larger project.
