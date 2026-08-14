// tz-lookup ships no type declarations. Keep the untyped import confined to
// this file so callers get a real signature.
// @ts-expect-error -- no bundled types; the runtime export is (lat, lng) => string
import tzLookup from "tz-lookup";

const lookup = tzLookup as (latitude: number, longitude: number) => string;

/**
 * IANA zone for a coordinate, or null when the coordinate is unusable.
 * Never throws — a location should still save if the lookup cannot place it.
 */
export function timezoneFromCoords(latitude: number, longitude: number): string | null {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    try {
        return lookup(latitude, longitude);
    } catch {
        return null;
    }
}
