/**
 * Centralized financial calculations for shifts.
 * Ensures strict integer math to avoid floating point errors.
 */

/**
 * Calculates the gross pay in cents for a shift segment.
 * 
 * Formula: Math.ceil((billableMinutes * hourlyRateCents) / 60)
 * 
 * @param billableMinutes - The number of payable minutes (total - break)
 * @param hourlyRateCents - The worker's hourly rate in cents
 * @returns Total pay in cents (integer)
 */
export function calculateShiftPay(billableMinutes: number, hourlyRateCents: number): number {
    if (billableMinutes <= 0 || hourlyRateCents <= 0) {
        return 0;
    }

    // Use integer math where possible, but division requires care.
    // We use Math.ceil to favor the worker for partial cents/minutes as per standard practice,
    // or standard rounding. The requirement specified Math.ceil.
    const pay = Math.ceil((billableMinutes * hourlyRateCents) / 60);
    return pay;
}
