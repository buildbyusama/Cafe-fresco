import PropTypes from 'prop-types';
import { Fragment } from 'react';
import { Link } from 'react-router-dom';

// Tiny safe formatter for assistant replies: **bold**, line breaks, "- " bullets and same-site links
// like /track?order=… . Everything is rendered as React text: no HTML is ever injected.
const SITE_LINK = /(\/(?:track|cart|products|product\/[a-f0-9]{24}|contact|login|signup|user\/profile|wishlist)(?:\?[\w=&%.-]*)?)/g;

function inline(text, key) {
    // bold first, then site links inside the plain parts
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={`${key}-${i}`}>{part.slice(2, -2)}</strong>;
        return part.split(SITE_LINK).map((bit, j) =>
            /^\/(track|cart|products|product\/|contact|login|signup|user\/profile|wishlist)/.test(bit) ? (
                <Link key={`${key}-${i}-${j}`} to={bit}>{bit.startsWith('/track') ? 'track order' : bit}</Link>
            ) : (
                <Fragment key={`${key}-${i}-${j}`}>{bit}</Fragment>
            )
        );
    });
}

export default function FormattedText({ text }) {
    const lines = String(text || '').split('\n');
    const out = [];
    let list = [];
    const flush = () => {
        if (list.length) out.push(<ul key={`ul-${out.length}`}>{list}</ul>);
        list = [];
    };
    lines.forEach((line, i) => {
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) list.push(<li key={i}>{inline(bullet[1], i)}</li>);
        else {
            flush();
            if (line.trim()) out.push(<p key={i}>{inline(line, i)}</p>);
        }
    });
    flush();
    return <>{out}</>;
}

FormattedText.propTypes = { text: PropTypes.string };
