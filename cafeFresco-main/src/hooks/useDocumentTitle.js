import { useEffect } from 'react';

const SITE = 'Cafe Fresco';

// Sets "<title> · Cafe Fresco" (or just the site name) while the page is mounted
export default function useDocumentTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} · ${SITE}` : SITE;
    }, [title]);
}
