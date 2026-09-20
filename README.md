# Supply Chain Planner

A fast, single-screen tool for planning production chains: define resources,
define process steps that turn inputs into outputs, mark what you want as
final — and get exactly how often every step must run.

## Run it

```sh
npm install
npm run dev     # http://localhost:5173
npm test        # solver unit tests
npm run build   # production bundle in dist/
```

## How to use (P1)

1. **Add resources** (left panel). Toggle **raw** for things supplied from
   outside (mined/bought) and **★** for final products you want.
2. **Add process steps** (middle). Each step has *Needs* (inputs) and *Makes*
   (outputs) with quantities. Duplicate a step with ⧉.
3. **Set target amounts** (right panel). The app instantly calculates how
   often each step runs and the balance of every resource
   (needed / balanced / surplus / missing).

Plans autosave to the browser (localStorage) and can be exported/imported as
JSON from the header.

## Roadmap

- **P1 (done):** resources, steps, final targets, backward calculation.
- **P2 (done):** time planning — set `s/run` on a step, mark a target as
  *per min* / *per hour*, and the result table shows how many parallel
  stations of each step kind you need (`src/model/throughput.ts`).
- **P3:** copy/paste of steps and whole sub-plans as reusable templates.

## How the calculation works

`src/model/solver.ts` builds one equation per non-raw resource
(produced − consumed = demand) and solves a weighted non-negative
least-squares system: target rows outweigh balance rows so demand is always
met as far as possible, and shortfalls are reported instead of silently
spread across the chain. Steps with negative solutions are clamped out
(active-set), so unused alternative producers show 0 runs.
