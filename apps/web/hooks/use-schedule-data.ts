export interface LocationOption {
    id: string;
    name: string;
    address: string;
}

export interface ContactOption {
    id: string;
    userId: string; // Linked user account
    name: string;
    phone: string;
    initials: string;
    role: string;
}

// Mock Data
const MOCK_LOCATIONS: LocationOption[] = [
    { id: "loc-1", name: "State Room", address: "60 State Street, Boston, MA, USA" },
    { id: "loc-2", name: "Alden Castle", address: "20 Chapel St, Brookline, MA 02446, USA" },
    { id: "loc-3", name: "Belle Mer", address: "2 Goat Island, Newport, RI, USA" },
    { id: "loc-4", name: "Newport Beach House", address: "3 Aquidneck Ave, Middletown, RI 02842, USA" },
    { id: "loc-5", name: "The Tower", address: "101 Arlington St, Boston, MA 02116, USA" },
];

const MOCK_CONTACTS: ContactOption[] = [
    { id: "c-1", userId: "user_2qXN4k7y8Z5m3P9r1", name: "Seville", phone: "(857) 505-6626", initials: "S", role: "Manager" }, // Assuming this matches current user for demo
    { id: "c-2", userId: "u-2", name: "Adam Baker", phone: "(617) 555-0123", initials: "AB", role: "Supervisor" },
    { id: "c-3", userId: "u-3", name: "Charlie Davis", phone: "(617) 555-0199", initials: "CD", role: "Manager" },
];

export function useLocations() {
    return {
        data: MOCK_LOCATIONS,
        isLoading: false,
        error: null
    };
}

export function useContacts() {
    return {
        data: MOCK_CONTACTS,
        isLoading: false,
        error: null
    };
}
