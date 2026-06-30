import { useState } from 'react';

/**
 * A small form exercising `onChange` (captured as `state_change`) and a submit
 * `button` (captured as `click`).
 */
export function SignupForm() {
  const [plan, setPlan] = useState('starter');

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
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
