import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';

const STEPS = [
    ['cart', 'Cart', '/cart', 'bi-bag'],
    ['address', 'Delivery', '/address', 'bi-geo-alt'],
    ['payment', 'Payment', '/payment', 'bi-credit-card']
];

// Cart → Delivery → Payment progress bar; finished steps link back
export default function CheckoutSteps({ current }) {
    const at = STEPS.findIndex(([key]) => key === current);
    return (
        <ol className="fk-steps" aria-label="Checkout steps">
            {STEPS.map(([key, label, to, icon], i) => {
                const state = i < at ? 'done' : i === at ? 'now' : 'next';
                const inner = (
                    <>
                        <span className="fk-step-dot">
                            <i className={`bi ${state === 'done' ? 'bi-check-lg' : icon}`} />
                        </span>
                        <span className="fk-step-label">{label}</span>
                    </>
                );
                return (
                    <li key={key} className={`fk-step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
                        {state === 'done' ? <Link to={to}>{inner}</Link> : <span>{inner}</span>}
                    </li>
                );
            })}
        </ol>
    );
}

CheckoutSteps.propTypes = { current: PropTypes.oneOf(['cart', 'address', 'payment']).isRequired };
