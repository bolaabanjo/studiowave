/** Countries for phone numbers: Nigeria first, then the rest of Africa's biggest markets, then elsewhere. */
export interface Country { code: string; name: string; dial: string; flag: string; example: string }

export const COUNTRIES: Country[] = [
    { code: "NG", name: "Nigeria", dial: "234", flag: "🇳🇬", example: "0801 234 5678" },
    { code: "GH", name: "Ghana", dial: "233", flag: "🇬🇭", example: "024 123 4567" },
    { code: "KE", name: "Kenya", dial: "254", flag: "🇰🇪", example: "0712 345678" },
    { code: "ZA", name: "South Africa", dial: "27", flag: "🇿🇦", example: "071 123 4567" },
    { code: "EG", name: "Egypt", dial: "20", flag: "🇪🇬", example: "0100 123 4567" },
    { code: "CI", name: "Côte d'Ivoire", dial: "225", flag: "🇨🇮", example: "01 23 45 67 89" },
    { code: "SN", name: "Senegal", dial: "221", flag: "🇸🇳", example: "77 123 45 67" },
    { code: "CM", name: "Cameroon", dial: "237", flag: "🇨🇲", example: "6 71 23 45 67" },
    { code: "UG", name: "Uganda", dial: "256", flag: "🇺🇬", example: "0712 345678" },
    { code: "TZ", name: "Tanzania", dial: "255", flag: "🇹🇿", example: "0621 234567" },
    { code: "RW", name: "Rwanda", dial: "250", flag: "🇷🇼", example: "0720 123 456" },
    { code: "ET", name: "Ethiopia", dial: "251", flag: "🇪🇹", example: "091 123 4567" },
    { code: "BJ", name: "Benin", dial: "229", flag: "🇧🇯", example: "01 90 01 12 34" },
    { code: "TG", name: "Togo", dial: "228", flag: "🇹🇬", example: "90 11 23 45" },
    { code: "GB", name: "United Kingdom", dial: "44", flag: "🇬🇧", example: "07400 123456" },
    { code: "US", name: "United States", dial: "1", flag: "🇺🇸", example: "(201) 555-0123" },
    { code: "CA", name: "Canada", dial: "1", flag: "🇨🇦", example: "(506) 234-5678" },
    { code: "AE", name: "United Arab Emirates", dial: "971", flag: "🇦🇪", example: "050 123 4567" },
    { code: "IE", name: "Ireland", dial: "353", flag: "🇮🇪", example: "085 012 3456" },
    { code: "DE", name: "Germany", dial: "49", flag: "🇩🇪", example: "01512 3456789" },
    { code: "FR", name: "France", dial: "33", flag: "🇫🇷", example: "06 12 34 56 78" },
];

/**
 * "+2348012345678" from a country and what was typed: a leading 0 (how
 * numbers are written at home) is dropped, and a number typed with its own +
 * is taken as it is. Null when it can't be a phone number.
 */
export function toInternational(country: Country, typed: string): string | null {
    const raw = typed.trim();
    const digits = raw.replace(/\D/g, "");
    if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
    const local = digits.startsWith(country.dial) && digits.length > country.dial.length + 6 ? digits.slice(country.dial.length) : digits.replace(/^0+/, "");
    const full = `${country.dial}${local}`;
    return local.length >= 6 && full.length <= 15 ? `+${full}` : null;
}
