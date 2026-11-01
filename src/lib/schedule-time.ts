/**
 * Times in the appointment book are the business's wall clock (cencori
 * lib/studio/schedule-slots.ts), whatever zone the phone is in: "2pm" on the
 * Schedule is 2pm at the salon.
 */

function parts(timeZone: string, at: Date) {
    const map = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
            .formatToParts(at)
            .map((part) => [part.type, part.value]),
    );
    return { year: map.year, month: map.month, day: map.day, hour: map.hour === "24" ? "00" : map.hour, minute: map.minute };
}

/** "2026-11-03": the business's calendar day of an instant. */
export function dayKey(timeZone: string, at: Date): string {
    const p = parts(timeZone, at);
    return `${p.year}-${p.month}-${p.day}`;
}

/** "2026-11-03T14:00": the business's wall clock of an instant, as the server takes a start. */
export function localStamp(timeZone: string, at: Date): string {
    const p = parts(timeZone, at);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The next `count` days from today, in the business's calendar. */
export function nextDays(timeZone: string, count: number, from = new Date()): string[] {
    const [year, month, day] = dayKey(timeZone, from).split("-").map(Number);
    return Array.from({ length: count }, (_, index) => new Date(Date.UTC(year, month - 1, day + index)).toISOString().slice(0, 10));
}

/** "Today", "Tomorrow", "Thu 5". */
export function dayLabel(timeZone: string, key: string): { top: string; bottom: string } {
    const [today, tomorrow] = nextDays(timeZone, 2);
    const date = new Date(`${key}T12:00:00Z`);
    const weekday = date.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
    return { top: key === today ? "Today" : key === tomorrow ? "Tmrw" : weekday, bottom: String(date.getUTCDate()) };
}

/** "Thursday 5 November". */
export function longDay(key: string): string {
    return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

/** "2pm", "9:30am" in the business's zone. */
export function clockLabel(timeZone: string, iso: string): string {
    const p = parts(timeZone, new Date(iso));
    const hour = Number(p.hour);
    return `${hour % 12 || 12}${p.minute !== "00" ? `:${p.minute}` : ""}${hour < 12 ? "am" : "pm"}`;
}

/** "09:00" → "9am". */
export function hourLabel(clock: string): string {
    const [hour, minute] = clock.split(":").map(Number);
    return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`;
}

/** "45 min", "4 h", "1 h 30". */
export function shortMinutes(total: number): string {
    const hours = Math.floor(total / 60);
    const minutes = total % 60;
    if (!hours) return `${minutes} min`;
    return minutes ? `${hours} h ${minutes}` : `${hours} h`;
}

/** "09:00" as a Date on a fixed day in UTC, for the time picker (shown with timeZoneName "UTC"); and back. */
export function clockToDate(clock: string): Date {
    const [hour, minute] = clock.split(":").map(Number);
    return new Date(Date.UTC(2026, 0, 1, hour, minute));
}
export function dateToClock(date: Date): string {
    return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}
