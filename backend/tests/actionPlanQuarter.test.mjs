import test from "node:test";
import assert from "node:assert/strict";
import {
  getQuarterInfo,
  summarizeInitiativesForQuarter
} from "../dist/utils/actionPlanQuarter.js";

test("quarter boundaries: Mar 31 is Q1, Apr 1 is Q2", () => {
  const mar = getQuarterInfo(new Date("2026-03-31T12:00:00Z"));
  const apr = getQuarterInfo(new Date("2026-04-01T12:00:00Z"));
  assert.equal(mar.quarter, 1);
  assert.equal(mar.label, "Q1 2026");
  assert.equal(apr.quarter, 2);
  assert.equal(apr.label, "Q2 2026");
});

test("quarter boundaries: Dec 31 is Q4, Jan 1 is Q1 next year", () => {
  const dec = getQuarterInfo(new Date("2026-12-31T12:00:00Z"));
  const jan = getQuarterInfo(new Date("2027-01-01T12:00:00Z"));
  assert.equal(dec.quarter, 4);
  assert.equal(dec.label, "Q4 2026");
  assert.equal(jan.quarter, 1);
  assert.equal(jan.label, "Q1 2027");
});

test("summarize initiatives filters by quarter overlap", () => {
  const initiatives = [
    { id: 1, name: "Q1 Initiative", segments: [{ start_month: 1, end_month: 2 }] },
    { id: 2, name: "Q2 Initiative", segments: [{ start_month: 4, end_month: 6 }] },
    { id: 3, name: "Cross Quarter", segments: [{ start_month: 3, end_month: 5 }] }
  ];
  const summary = summarizeInitiativesForQuarter(initiatives, new Date("2026-02-15T12:00:00Z"), 5);
  const titles = summary.items.map((item) => item.title);
  assert.deepEqual(titles, ["Q1 Initiative", "Cross Quarter"]);
});
