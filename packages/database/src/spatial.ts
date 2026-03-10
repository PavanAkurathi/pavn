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

export const jsonPositionToGeography = (column: SQLWrapper) =>
    sql`(${jsonPositionToGeometry(column)})::geography`;

export const jsonPositionLatitude = (column: SQLWrapper) =>
    sql<number>`((${column} ->> 'lat')::double precision)`.mapWith(Number);

export const jsonPositionLongitude = (column: SQLWrapper) =>
    sql<number>`((${column} ->> 'lng')::double precision)`.mapWith(Number);
