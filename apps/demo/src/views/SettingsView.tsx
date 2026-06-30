import { SignupForm, ThemeSwitcher, FilterPanel } from '../components/forms.js';
import { Accordion } from '../components/feedback.js';

export function SettingsView() {
  return (
    <div className="view">
      <header className="view-head">
        <h1>Settings</h1>
        <p className="muted">Form fields and toggles generate input and state_change events.</p>
      </header>

      <div className="grid two">
        <div className="card">
          <h2>Account</h2>
          <SignupForm />
        </div>

        <div className="card">
          <h2>Preferences</h2>
          <ThemeSwitcher />
          <div className="spacer" />
          <FilterPanel />
        </div>
      </div>

      <div className="card">
        <h2>Help</h2>
        <Accordion title="How is my data handled?">
          <p>Only anonymized, primitive properties are captured. No PII is ever stored.</p>
        </Accordion>
        <Accordion title="Can I disable tracking?">
          <p>Yes - decline consent in the banner, or revoke it any time.</p>
        </Accordion>
      </div>
    </div>
  );
}
