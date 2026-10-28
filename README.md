# Witnessmark

GPS-interference intelligence for drones: **Witnessmark Routes** (GO / CAUTION / NO-GO before a flight) and **DroneProof** (independent, tamper-evident evidence after an incident).

## Where things live

| Area | Files |
|---|---|
| DroneProof evidence method (v0.4) | `src/lib/evidence.ts`, tests in `src/test/evidence.test.ts` |
| Routes flight decision method (v0.2) | `src/lib/routeRisk.ts`, tests in `src/test/routeRisk.test.ts` |
| Case file page | `src/routes/analysis.$scenarioId.tsx`, PDF in `src/lib/casePdf.ts`, audit chain in `src/lib/caseLog.ts` |
| Route check page | `src/routes/routes.check.tsx`, map in `src/components/routes/RouteMap.tsx`, exports in `src/lib/routeExport.ts` |
| Brand, contact email, versions | `src/lib/site.ts` |
| Design tokens | `src/styles.css` (`.dark` block) |

Run the tests with `npx vitest run`. Every threshold is provisional; change them in the two method files and update the Method page changelog.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7869efee-2488-41d2-a928-7df2aae078dc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
