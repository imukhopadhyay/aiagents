import { describe, expect, it } from "vitest";

import { clockInStatus, formatTimeIn, workedHours, zonedDateTime } from "@/lib/domain/attendance";
import { parseCsv, parseCsvRecords, toCsv } from "@/lib/domain/csv";
import {
  addDays,
  eachDay,
  isDateKey,
  isWeekend,
  monthRange,
  rangesOverlap,
  shiftMonth,
  todayIn,
} from "@/lib/domain/dates";
import {
  accruedDays,
  availableDays,
  carryOver,
  countLeaveDays,
  initialLeaveStatus,
  isCancellable,
  nextLeaveStatus,
} from "@/lib/domain/leave";
import { buildTree, descendantIds, wouldCreateCycle } from "@/lib/domain/org";
import { canMoveStage, daysBetween } from "@/lib/domain/recruitment";

const NO_HOLIDAYS = new Set<string>();

describe("dates", () => {
  it("validates date keys", () => {
    expect(isDateKey("2026-02-28")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-2-1")).toBe(false);
  });

  it("does date arithmetic in UTC", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(eachDay("2026-02-27", "2026-03-02")).toEqual([
      "2026-02-27",
      "2026-02-28",
      "2026-03-01",
      "2026-03-02",
    ]);
    expect(isWeekend("2026-10-03")).toBe(true); // Saturday
    expect(isWeekend("2026-10-05")).toBe(false); // Monday
  });

  it("handles months", () => {
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("detects overlapping ranges", () => {
    expect(rangesOverlap({ start: "2026-01-01", end: "2026-01-05" }, { start: "2026-01-05", end: "2026-01-09" })).toBe(true);
    expect(rangesOverlap({ start: "2026-01-01", end: "2026-01-04" }, { start: "2026-01-05", end: "2026-01-09" })).toBe(false);
  });

  it("finds today in a time zone", () => {
    const instant = new Date("2026-10-02T02:00:00Z");
    expect(todayIn("UTC", instant)).toBe("2026-10-02");
    expect(todayIn("America/New_York", instant)).toBe("2026-10-01");
  });
});

describe("countLeaveDays", () => {
  it("skips weekends", () => {
    // Fri 2026-10-02 to Tue 2026-10-06 → Fri, Mon, Tue
    expect(countLeaveDays({ start: "2026-10-02", end: "2026-10-06" }, NO_HOLIDAYS)).toBe(3);
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-10-05"]);
    expect(countLeaveDays({ start: "2026-10-02", end: "2026-10-06" }, holidays)).toBe(2);
  });

  it("handles half days", () => {
    expect(
      countLeaveDays({ start: "2026-10-05", end: "2026-10-07", startHalfDay: true }, NO_HOLIDAYS),
    ).toBe(2.5);
    expect(
      countLeaveDays(
        { start: "2026-10-05", end: "2026-10-07", startHalfDay: true, endHalfDay: true },
        NO_HOLIDAYS,
      ),
    ).toBe(2);
    expect(countLeaveDays({ start: "2026-10-05", end: "2026-10-05", endHalfDay: true }, NO_HOLIDAYS)).toBe(0.5);
  });

  it("ignores half-day flags on non-working days", () => {
    // Starts on Saturday with a half-day flag: Mon and Tue still count fully.
    expect(
      countLeaveDays({ start: "2026-10-03", end: "2026-10-06", startHalfDay: true }, NO_HOLIDAYS),
    ).toBe(2);
  });

  it("returns 0 for weekend-only and reversed ranges", () => {
    expect(countLeaveDays({ start: "2026-10-03", end: "2026-10-04" }, NO_HOLIDAYS)).toBe(0);
    expect(countLeaveDays({ start: "2026-10-06", end: "2026-10-05" }, NO_HOLIDAYS)).toBe(0);
  });
});

describe("leave workflow", () => {
  it("computes available days", () => {
    expect(availableDays({ allocated: 20, carriedOver: 2, used: 5 }, 3)).toBe(14);
  });

  it("starts requests in the right state", () => {
    expect(initialLeaveStatus({ requiresApproval: false, hasManager: true })).toBe("APPROVED");
    expect(initialLeaveStatus({ requiresApproval: true, hasManager: true })).toBe("PENDING");
    expect(initialLeaveStatus({ requiresApproval: true, hasManager: false })).toBe("MANAGER_APPROVED");
  });

  it("moves through manager then HR approval", () => {
    expect(nextLeaveStatus("PENDING", "approve", "manager")).toBe("MANAGER_APPROVED");
    expect(nextLeaveStatus("MANAGER_APPROVED", "approve", "manager")).toBeNull();
    expect(nextLeaveStatus("MANAGER_APPROVED", "approve", "hr")).toBe("APPROVED");
    expect(nextLeaveStatus("PENDING", "approve", "hr")).toBe("APPROVED");
    expect(nextLeaveStatus("PENDING", "reject", "manager")).toBe("REJECTED");
    expect(nextLeaveStatus("APPROVED", "reject", "hr")).toBeNull();
    expect(nextLeaveStatus("CANCELLED", "approve", "hr")).toBeNull();
  });

  it("allows cancelling open or future requests only", () => {
    expect(isCancellable("PENDING", "2026-01-01", "2026-06-01")).toBe(true);
    expect(isCancellable("APPROVED", "2026-07-01", "2026-06-01")).toBe(true);
    expect(isCancellable("APPROVED", "2026-05-01", "2026-06-01")).toBe(false);
    expect(isCancellable("REJECTED", "2026-07-01", "2026-06-01")).toBe(false);
  });
});

describe("accrual and carry-over", () => {
  it("accrues monthly allowances by month", () => {
    expect(accruedDays(20, "MONTHLY", 1)).toBe(1.5);
    expect(accruedDays(20, "MONTHLY", 6)).toBe(10);
    expect(accruedDays(20, "MONTHLY", 12)).toBe(20);
    expect(accruedDays(20, "YEARLY", 1)).toBe(20);
    expect(accruedDays(0, "NONE", 5)).toBe(0);
  });

  it("caps carry-over", () => {
    expect(carryOver({ allocated: 20, carriedOver: 0, used: 12 }, 5)).toBe(5);
    expect(carryOver({ allocated: 20, carriedOver: 0, used: 18 }, 5)).toBe(2);
    expect(carryOver({ allocated: 20, carriedOver: 0, used: 25 }, 5)).toBe(0);
  });
});

describe("org", () => {
  const parentOf = new Map<string, string | null>([
    ["root", null],
    ["a", "root"],
    ["b", "a"],
    ["c", "b"],
  ]);

  it("detects cycles", () => {
    expect(wouldCreateCycle("a", "c", parentOf)).toBe(true);
    expect(wouldCreateCycle("a", "a", parentOf)).toBe(true);
    expect(wouldCreateCycle("c", "root", parentOf)).toBe(false);
    expect(wouldCreateCycle("b", null, parentOf)).toBe(false);
  });

  it("builds trees and finds descendants", () => {
    const items = [
      { id: "root", parentId: null },
      { id: "a", parentId: "root" },
      { id: "b", parentId: "a" },
      { id: "orphan", parentId: "missing" },
    ];
    const tree = buildTree(items, (i) => i.parentId);
    expect(tree.map((n) => n.id)).toEqual(["root", "orphan"]);
    expect(tree[0]!.children[0]!.children[0]!.id).toBe("b");
    expect([...descendantIds("root", items)].sort()).toEqual(["a", "b"]);
  });
});

describe("csv", () => {
  it("parses quotes, escapes, CRLF and BOM", () => {
    const text = '﻿name,note\r\n"Smith, Jo","said ""hi"""\r\n\r\nLee,"multi\nline"\n';
    expect(parseCsv(text)).toEqual([
      ["name", "note"],
      ["Smith, Jo", 'said "hi"'],
      ["Lee", "multi\nline"],
    ]);
  });

  it("maps records by header", () => {
    const { headers, records } = parseCsvRecords("First Name,Email\n Ana , ana@x.com\n");
    expect(headers).toEqual(["first name", "email"]);
    expect(records).toEqual([{ "first name": "Ana", email: "ana@x.com" }]);
  });

  it("writes CSV and neutralises formulas", () => {
    expect(toCsv([["a,b", 'q"', null, "=SUM(A1)", 3]])).toBe('"a,b","q""",,\'=SUM(A1),3\r\n');
  });

  it("round-trips", () => {
    const rows = [["x", "y, z"], ['"quoted"', "line\nbreak"]];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe("attendance", () => {
  it("marks late clock-ins in the location's time zone", () => {
    // 13:05Z = 09:05 in New York (EDT) → within grace
    expect(clockInStatus(new Date("2026-10-02T13:05:00Z"), "America/New_York")).toBe("PRESENT");
    // 13:15Z = 09:15 in New York → late
    expect(clockInStatus(new Date("2026-10-02T13:15:00Z"), "America/New_York")).toBe("LATE");
    expect(clockInStatus(new Date("2026-01-15T09:05:00Z"), "Europe/London")).toBe("PRESENT");
  });

  it("computes worked hours", () => {
    expect(workedHours(new Date("2026-10-02T09:00:00Z"), new Date("2026-10-02T17:30:00Z"))).toBe(8.5);
    expect(workedHours(new Date("2026-10-02T09:00:00Z"), null)).toBeNull();
  });

  it("converts local wall-clock times to instants", () => {
    expect(zonedDateTime("2026-10-02", "09:00", "America/New_York").toISOString()).toBe(
      "2026-10-02T13:00:00.000Z",
    );
    expect(zonedDateTime("2026-01-15", "09:00", "Europe/London").toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    );
    expect(zonedDateTime("2026-10-02", "08:30", "Asia/Tokyo").toISOString()).toBe(
      "2026-10-01T23:30:00.000Z",
    );
    expect(formatTimeIn(new Date("2026-10-02T13:00:00Z"), "America/New_York")).toBe("09:00");
  });
});

describe("recruitment", () => {
  it("guards stage moves", () => {
    expect(canMoveStage("APPLIED", "SCREENING")).toBe(true);
    expect(canMoveStage("INTERVIEW", "REJECTED")).toBe(true);
    expect(canMoveStage("REJECTED", "SCREENING")).toBe(true);
    expect(canMoveStage("OFFER", "HIRED")).toBe(false);
    expect(canMoveStage("HIRED", "OFFER")).toBe(false);
    expect(canMoveStage("OFFER", "OFFER")).toBe(false);
  });

  it("counts days between dates", () => {
    expect(daysBetween(new Date("2026-01-01"), new Date("2026-01-31"))).toBe(30);
  });
});
