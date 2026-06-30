import { useState } from 'react';
import { track } from '@fiber-analytics/browser';
import { useToast } from '../toast.js';

/**
 * Exercises `input` (email field), `state_change` (plan select), and `submit`.
 */
export function SignupForm() {
  const [plan, setPlan] = useState('starter');
  const { notify } = useToast();

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        track('signup_submitted', { plan });
        notify('Account created', 'success');
      }}
    >
      <label className="field">
        <span>Email</span>
        <input type="email" name="email" placeholder="you@example.com" onChange={() => {}} />
      </label>

      <label className="field">
        <span>Plan</span>
        <select name="plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </label>

      <button type="submit" className="button primary" label="signup-submit">
        Create account
      </button>
    </form>
  );
}

/** A second, smaller form to add `submit` + `input` volume. */
export function NewsletterForm() {
  const { notify } = useToast();
  return (
    <form
      className="form inline"
      onSubmit={(e) => {
        e.preventDefault();
        track('newsletter_subscribed');
        notify('Subscribed to the newsletter', 'success');
      }}
    >
      <input type="email" name="newsletter_email" placeholder="Email for updates" onChange={() => {}} />
      <button type="submit" className="button primary" label="newsletter-subscribe">
        Subscribe
      </button>
    </form>
  );
}

/**
 * Checkboxes, a radio group, and a range slider. Every change is captured as a
 * `state_change`, and the slider also produces debounced `input` events.
 */
export function FilterPanel() {
  const [inStock, setInStock] = useState(true);
  const [onSale, setOnSale] = useState(false);
  const [sort, setSort] = useState('popular');
  const [maxPrice, setMaxPrice] = useState(100);

  return (
    <div className="filters">
      <label className="check">
        <input
          type="checkbox"
          name="in_stock"
          checked={inStock}
          onChange={(e) => setInStock(e.target.checked)}
        />
        <span>In stock only</span>
      </label>
      <label className="check">
        <input
          type="checkbox"
          name="on_sale"
          checked={onSale}
          onChange={(e) => setOnSale(e.target.checked)}
        />
        <span>On sale</span>
      </label>

      <fieldset className="radio-group">
        <legend>Sort by</legend>
        {['popular', 'newest', 'price'].map((option) => (
          <label key={option} className="radio">
            <input
              type="radio"
              name="sort"
              value={option}
              checked={sort === option}
              onChange={(e) => setSort(e.target.value)}
            />
            <span>{option}</span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>Max price: ${maxPrice}</span>
        <input
          type="range"
          name="max_price"
          min={0}
          max={500}
          step={10}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

/** Theme selector emitting `state_change` + a custom `theme_changed` event. */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState('system');
  const { notify } = useToast();

  return (
    <label className="field">
      <span>Theme</span>
      <select
        name="theme"
        value={theme}
        onChange={(e) => {
          setTheme(e.target.value);
          track('theme_changed', { theme: e.target.value });
          notify(`Theme set to ${e.target.value}`);
        }}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
