import { sql, type SQLWrapper } from "drizzle-orm";

export type LatLng = {
    lat: number;
    lng: number;
};

export const toLatLng = (lat: number, lng: number): LatLng => ({ lat, lng });

export const jsonPositionToGeometry = (column: SQLWrapper) => sql`
    ST_SetSRID(
        ST_MakePoint(
            ((${column} ->> 'lng')::double precision),
            ((${column} ->> 'lat')::double precision)
        ),
        4326
    )
`;

// The outer parentheses are load-bearing for CREATE INDEX. Postgres only lets an
// expression index omit surrounding parens when the expression is a plain
// function call; a cast needs its own. drizzle-kit adds exactly one paren layer,
// so without these the generated index is `USING gist ((expr)::geography)` and
// fails with `syntax error at or near "::"`. Harmless everywhere else.
export const jsonPositionToGeography = (column: SQLWrapper) =>
    sql`((${jsonPositionToGeometry(column)})::geography)`;

export const jsonPositionLatitude = (column: SQLWrapper) =>
    sql<number>`((${column} ->> 'lat')::double precision)`.mapWith(Number);

export const jsonPositionLongitude = (column: SQLWrapper) =>
    sql<number>`((${column} ->> 'lng')::double precision)`.mapWith(Number);
