import{describe,expect,it}from"vitest";
import{compactTimeLabel,fullLocalDateLabel,selectFormattedTimeTicks,selectTimeTicks,timeTickLimit}from"../lib/timeAxis";
const days=Array.from({length:20},(_,index)=>`2026-01-${String(index+1).padStart(2,"0")}`);
describe("responsive time axes",()=>{
  it("limits phone and desktop tick requests without removing points",()=>{expect(timeTickLimit(375)).toBe(4);expect(selectTimeTicks(days,timeTickLimit(375))).toHaveLength(4);expect(timeTickLimit(1200)).toBe(8);expect(selectTimeTicks(days,timeTickLimit(1200))).toHaveLength(8);expect(days).toHaveLength(20)});
  it("uses compact day labels for short ranges",()=>expect(compactTimeLabel("2026-01-14",days)).toBe("1/14"));
  it("uses month/year for longer and monthly ranges",()=>{const long=["2025-12-01","2026-03-01"];expect(compactTimeLabel(long[0],long)).toBe("12/2025");expect(compactTimeLabel("2026-03-01",long,"monthly")).toBe("Mar 2026")});
  it("avoids duplicate formatted labels",()=>{const values=["2026-01-01","2026-01-15","2026-02-01","2026-02-15"];expect(selectFormattedTimeTicks(values,8).map(value=>compactTimeLabel(value,values))).toEqual(["1/2026","2/2026"])});
  it("keeps full local dates for tooltips without UTC shifting",()=>{expect(fullLocalDateLabel("2025-12-31")).toMatch(/December 31, 2025|31 December 2025/);expect(fullLocalDateLabel("2026-01-01")).toMatch(/January 1, 2026|1 January 2026/)})
});

it('supports medium, multi-month and multi-year ranges at narrow and desktop widths',()=>{for(const dates of [['2026-09-01','2026-09-03'],['2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01','2026-06-01'],['2020-01-01','2021-01-01','2022-01-01','2023-01-01','2024-01-01','2025-01-01','2026-01-01']])for(const width of [240,375,700,1200]){const copy=[...dates],ticks=selectFormattedTimeTicks(dates,timeTickLimit(width));expect(ticks.length).toBeLessThanOrEqual(timeTickLimit(width));expect(new Set(ticks.map(date=>compactTimeLabel(date,dates))).size).toBe(ticks.length);expect(ticks).toEqual([...ticks].sort());expect(dates).toEqual(copy);}expect(compactTimeLabel('2026-01-01',[],'yearly')).toBe('2026');});
