import { PricingTier, type Tier } from '../components/commerce.js';
import { NewsletterForm } from '../components/forms.js';

const TIERS: Tier[] = [
  {
    id: 'tier-starter',
    name: 'Starter',
    price: 0,
    features: ['1 project', 'Community support', 'Basic analytics'],
  },
  {
    id: 'tier-pro',
    name: 'Pro',
    price: 29,
    features: ['Unlimited projects', 'Email support', 'Advanced analytics', 'Custom events'],
    highlighted: true,
  },
  {
    id: 'tier-scale',
    name: 'Scale',
    price: 99,
    features: ['SSO & roles', 'Priority support', 'Data export', 'SLA'],
  },
];

export function PricingView() {
  return (
    <div className="view">
      <header className="view-head">
        <h1>Pricing</h1>
        <p className="muted">Pick a plan. Each selection fires a custom plan_selected event.</p>
      </header>

      <div className="tier-grid">
        {TIERS.map((tier) => (
          <PricingTier key={tier.id} tier={tier} />
        ))}
      </div>

      <section className="card cta-band">
        <div>
          <h2>Stay in the loop</h2>
          <p className="muted">Get product updates in your inbox.</p>
        </div>
        <NewsletterForm />
      </section>
    </div>
  );
}
