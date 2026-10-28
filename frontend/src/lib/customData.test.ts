import { describe, expect, it } from "vitest";
import { parsePasted, prepare } from "./customData";

const row = (label: string, value: string, id = label + value) => ({ id, label, value });

describe("build-your-own-chart data", () => {
  it("turns typed rows into points and ignores blank rows", () => {
    const p = prepare([row("Maths", "12"), row("", ""), row("Science", " 18 ")], "entered");
    expect(p.points).toEqual([{ name: "Maths", value: 12 }, { name: "Science", value: 18 }]);
    expect(p.ignored).toEqual([]);
    expect(p.total).toBe(30);
    expect(p.average).toBe(15);
  });
  it("reports unreadable rows instead of charting them", () => {
    const p = prepare([row("A", "abc", "1"), row("", "5", "2"), row("B", "3", "3")], "entered");
    expect(p.points).toEqual([{ name: "B", value: 3 }]);
    expect(p.ignored.map((i) => i.row)).toEqual([1, 2]);
  });
  it("adds duplicate names together and counts the merge", () => {
    const p = prepare([row("Apple", "2", "1"), row("Apple", "3.5", "2")], "entered");
    expect(p.points).toEqual([{ name: "Apple", value: 5.5 }]);
    expect(p.merged).toBe(1);
  });
  it("accepts decimals, negatives and thousands separators; sorts on request", () => {
    const p = prepare([row("a", "1,200", "1"), row("b", "-4", "2"), row("c", "7.25", "3")], "high");
    expect(p.points.map((x) => x.value)).toEqual([1200, 7.25, -4]);
    expect(p.max?.name).toBe("a");
    expect(p.min?.name).toBe("b");
  });
  it("handles an empty table", () => {
    expect(prepare([], "entered")).toMatchObject({ points: [], average: null, max: null, total: 0 });
  });
  it("parses pasted lines in several formats", () => {
    const { rows, skipped } = parsePasted("Maths, 12\nScience\t18\nEnglish: 9\nArt 7\nbad line\n\n\"Social, Studies\", 5");
    expect(rows.map((r) => [r.label, r.value])).toEqual([["Maths", "12"], ["Science", "18"], ["English", "9"], ["Art", "7"], ["\"Social, Studies\"".replace(/"/g, ""), "5"]]);
    expect(skipped).toBe(1);
  });
});
