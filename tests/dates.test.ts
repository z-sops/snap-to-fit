import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emergencyInstruction,
  emergencyNumber,
  emergencyService,
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatTime,
  regionFor,
} from "../src/core/locale";

/** Runs a check with a fixed IANA time zone so results are deterministic. */
function inTimeZone(zone: string, run: () => void) {
  const before = process.env.TZ;
  process.env.TZ = zone;
  try {
    run();
  } finally {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  }
}

test("a calendar date is the same day in every time zone", () => {
  const zones = [
    "America/Los_Angeles",
    "America/New_York",
    "America/Toronto",
    "Europe/London",
    "Pacific/Auckland",
  ];
  for (const zone of zones)
    inTimeZone(zone, () => {
      // A date-only string is read as written and never moves a day.
      assert.equal(formatDate("2026-10-21", "US"), "10/21/2026");
      assert.equal(formatDate("2026-10-21", "CA"), "2026-10-21");
      assert.equal(formatDate("2026-10-21", "GB"), "21/10/2026");
      assert.equal(formatDayMonth("2026-10-21", "US"), "Oct 21");
      assert.equal(formatDayMonth("2026-10-21", "GB"), "21 Oct");
      // A calendar date carries no time, so none is invented.
      assert.equal(formatTime("2026-10-21", "US"), "");
      assert.equal(formatDateTime("2026-10-21", "GB"), "21 Oct");
      // The first of the month and a leap day behave the same way.
      assert.equal(formatDate("2026-01-01", "GB"), "01/01/2026");
      assert.equal(formatDate("2028-02-29", "GB"), "29/02/2028");
    });
});

test("an instant is read in the device's own time zone", () => {
  inTimeZone("America/Los_Angeles", () => {
    // 03:30 UTC is still the 20th in California.
    assert.equal(formatDate("2026-10-21T03:30:00Z", "US"), "10/20/2026");
    assert.equal(formatTime("2026-10-21T03:30:00Z", "US"), "8:30 PM");
  });
  inTimeZone("America/New_York", () => {
    // The same instant is still the 20th in New York at that hour.
    assert.equal(formatDate("2026-10-21T03:30:00Z", "US"), "10/20/2026");
    assert.equal(formatTime("2026-10-21T03:30:00Z", "US"), "11:30 PM");
    // Four hours later it is the 21st in New York.
    assert.equal(formatDate("2026-10-21T04:30:00Z", "US"), "10/21/2026");
  });
  inTimeZone("Europe/London", () => {
    assert.equal(formatDate("2026-10-21T03:30:00Z", "GB"), "21/10/2026");
    assert.equal(formatTime("2026-10-21T03:30:00Z", "GB"), "04:30");
  });
});

test("instants around a daylight-saving change are read correctly", () => {
  inTimeZone("America/New_York", () => {
    // Spring forward: 8 March 2026, 02:00 becomes 03:00.
    assert.equal(formatDate("2026-03-08T06:59:00Z", "US"), "3/8/2026");
    assert.equal(formatDate("2026-03-08T07:00:00Z", "US"), "3/8/2026");
    assert.equal(formatTime("2026-03-08T07:00:00Z", "US"), "3:00 AM");
    // Fall back: 1 November 2026, 02:00 becomes 01:00.
    assert.equal(formatDate("2026-11-01T05:59:00Z", "US"), "11/1/2026");
    assert.equal(formatTime("2026-11-01T05:59:00Z", "US"), "1:59 AM");
    assert.equal(formatDate("2026-11-01T06:30:00Z", "US"), "11/1/2026");
  });
  inTimeZone("Europe/London", () => {
    // Spring forward: 29 March 2026, 01:00 becomes 02:00.
    assert.equal(formatDate("2026-03-29T00:59:00Z", "GB"), "29/03/2026");
    assert.equal(formatDate("2026-03-29T01:00:00Z", "GB"), "29/03/2026");
    // Fall back: 25 October 2026, 02:00 becomes 01:00.
    assert.equal(formatDate("2026-10-25T00:59:00Z", "GB"), "25/10/2026");
    assert.equal(formatDate("2026-10-25T01:30:00Z", "GB"), "25/10/2026");
  });
  inTimeZone("America/Los_Angeles", () => {
    // Spring forward: 8 March 2026, 02:00 becomes 03:00.
    assert.equal(formatDate("2026-03-08T09:59:00Z", "US"), "3/8/2026");
    assert.equal(formatDate("2026-03-08T10:00:00Z", "US"), "3/8/2026");
  });
});

test("an unsupported country is never told that 911 is its emergency number", () => {
  // The three supported markets name a number.
  assert.equal(emergencyNumber("US"), "911");
  assert.equal(emergencyNumber("CA"), "911");
  assert.equal(emergencyNumber("GB"), "999");
  // Every other country is told to use the local number instead.
  assert.equal(emergencyNumber("INTL"), "");
  assert.equal(emergencyService("INTL"), "your local emergency number");
  assert.equal(emergencyInstruction("INTL"), "call your local emergency number");
  // A saved home country is not a claim about where the user is right now.
  assert.equal(emergencyInstruction("US"), "call 911");
  assert.equal(emergencyInstruction("CA"), "call 911");
  assert.equal(emergencyInstruction("GB"), "call 999");
  // A country the app does not support maps to the international pack.
  assert.equal(regionFor("DE"), "INTL");
  assert.equal(emergencyInstruction(regionFor("DE")), "call your local emergency number");
});
