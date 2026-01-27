import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://workershive.com';

export default function sitemap(): MetadataRoute.Sitemap {
    const routes = [
        '',
        '/pricing',
        '/locations',
        '/resources',
        '/auth/sign-in',
        '/auth/signup',
        '/demo',
    ].map((route) => ({
        url: `${baseUrl}${route}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));

    return routes;
}
