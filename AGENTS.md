# Project instructions

## Project layout

- The frontend is a React and TypeScript application in `src/`. Keep UI components with their related styles in `src/components/`, and follow the naming and import patterns of nearby files.
- The game UI is composed from `src/app.tsx`; shared game state and Socket.IO event handling live in `src/context.tsx`. Keep shared state and socket protocol changes consistent with their consumers.
- Shared game and user types are in `src/utils/interfaces.tsx`. Reuse or update those types when changing data passed between components.
- `server.js` is the demo Express and Socket.IO backend. Keep event names and payloads compatible with the frontend when changing the demo protocol.
- Public assets are under `public/` and source assets are under `src/assets/`. Avoid editing generated or bundled files in `build/` and dependency files in `node_modules/`.

## Commands

- Install dependencies with `npm install` when dependencies need to be restored.
- Start the frontend with `npm start`; start the demo backend separately with `npm run server`.
- Build the frontend with `npm run build`.
- Run tests with `npm test -- --watchAll=false`. Run the relevant tests after a behavior change; if no applicable tests exist, report that rather than implying they passed.
- There is no dedicated lint script in `package.json`; don't claim a lint check was run unless you use another available project-supported command.

## Change guidance

- Make focused changes and preserve existing behavior and nearby formatting.
- Add or update tests for behavior changes when the repository has a suitable test location and pattern.
- Treat `.env` and `.env.*` as secret-bearing local configuration: do not read, reproduce, or commit their contents. Use environment-variable names from source code when configuration changes are needed.
- Do not update generated build artifacts as a substitute for changing their source.
