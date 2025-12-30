export const fetcher = async (url: string) => {
    // Assuming requests go to your Next.js API proxy or directly to the Shift Service
    // If direct to Shift Service (Port 4005), ensure URL includes base.
    const res = await fetch(url);

    if (!res.ok) {
        const error = new Error('An error occurred while fetching the data.');
        // Attach extra info to the error object.
        (error as any).info = await res.json();
        (error as any).status = res.status;
        throw error;
    }

    return res.json();
};
