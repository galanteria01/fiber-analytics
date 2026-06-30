import { track } from '@fiber-analytics/browser';
import { useToast } from '../toast.js';
import { QuantityStepper } from './controls.js';

export interface Product {
  id: string;
  name: string;
  price: number;
  tag?: string;
}

/**
 * Product card. The static `name`/`price` props are captured at build time into
 * `data-fa-props`, and the add-to-cart button emits a `click` plus a custom
 * `add_to_cart` event.
 */
export function ProductCard({ product }: { product: Product }) {
  const { notify } = useToast();
  return (
    <article className="product-card">
      <div className="product-media" aria-hidden="true">
        {product.name.charAt(0)}
      </div>
      <div className="product-info">
        <div className="product-head">
          <h3>{product.name}</h3>
          {product.tag ? <span className="pill">{product.tag}</span> : null}
        </div>
        <p className="price">${product.price.toFixed(2)}</p>
        <QuantityStepper />
        <button
          className="button primary block"
          label="add-to-cart"
          onClick={() => {
            track('add_to_cart', { product: product.name, price: product.price });
            notify(`Added ${product.name} to cart`, 'success');
          }}
        >
          Add to cart
        </button>
      </div>
    </article>
  );
}

export interface Tier {
  id: string;
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}

/** Pricing tier with a select button emitting a custom `plan_selected` event. */
export function PricingTier({ tier }: { tier: Tier }) {
  const { notify } = useToast();
  return (
    <article className={`tier ${tier.highlighted ? 'highlighted' : ''}`}>
      <h3>{tier.name}</h3>
      <p className="tier-price">
        ${tier.price}
        <span>/mo</span>
      </p>
      <ul className="tier-features">
        {tier.features.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      <button
        className={`button block ${tier.highlighted ? 'primary' : ''}`}
        label="select-plan"
        onClick={() => {
          track('plan_selected', { plan: tier.name, price: tier.price });
          notify(`Selected the ${tier.name} plan`, 'success');
        }}
      >
        Choose {tier.name}
      </button>
    </article>
  );
}
