import * as SecureStore from 'expo-secure-store';
import { authClient } from './auth-client';
import { CONFIG } from './config';

const SESSION_TOKEN_KEY = 'better-auth.session_token';
const ACTIVE_ORG_KEY = 'worker.active_org_id';

type WorkerOrganizationsResponse = {
    organizations?: Array<{ id: string }>;
};

export async function getStoredActiveOrganizationId(): Promise<string | null> {
    return SecureStore.getItemAsync(ACTIVE_ORG_KEY);
}

export async function setStoredActiveOrganizationId(orgId: string): Promise<void> {
    await SecureStore.setItemAsync(ACTIVE_ORG_KEY, orgId);
}

export async function clearStoredActiveOrganizationId(): Promise<void> {
    await SecureStore.deleteItemAsync(ACTIVE_ORG_KEY);
}

export async function resolveActiveOrganizationId(refresh = false): Promise<string | null> {
    if (!refresh) {
        const storedOrgId = await getStoredActiveOrganizationId();
        if (storedOrgId) {
            return storedOrgId;
        }
    }

    const session = await authClient.getSession();
    const sessionOrgId = session.data?.session?.activeOrganizationId;
    if (sessionOrgId) {
        await setStoredActiveOrganizationId(sessionOrgId);
        return sessionOrgId;
    }

    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    if (!token) {
        return null;
    }

    const response = await fetch(`${CONFIG.API_URL}/worker/organizations`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        return null;
    }

    const body = await response.json() as WorkerOrganizationsResponse;
    const orgId = body.organizations?.[0]?.id ?? null;

    if (orgId) {
        await setStoredActiveOrganizationId(orgId);
    }

    return orgId;
}

export async function bootstrapOrganizationContext(): Promise<string | null> {
    const session = await authClient.getSession();
    if (!session.data?.user) {
        return null;
    }

    return resolveActiveOrganizationId();
}
