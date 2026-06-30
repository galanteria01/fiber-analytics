import { describe, expect, it } from 'vitest';
import { transformSource } from './transform.js';

function transform(code: string, filename = 'Component.tsx'): string {
  const result = transformSource(code, filename);
  return result?.code ?? '';
}

describe('transformSource', () => {
  it('tags native button elements with the component name', () => {
    const out = transform(`
      function SaveBar() {
        return <button onClick={save}>Save</button>;
      }
    `);
    expect(out).toContain('data-fa-comp="SaveBar"');
  });

  it('tags arrow-function component elements', () => {
    const out = transform(`
      const Toolbar = () => {
        return <a href="/home">Home</a>;
      };
    `);
    expect(out).toContain('data-fa-comp="Toolbar"');
  });

  it('tags custom elements that declare an onChange handler', () => {
    const out = transform(`
      function Form() {
        return <TextField onChange={handle} />;
      }
    `);
    expect(out).toContain('data-fa-comp="Form"');
  });

  it('safelists only primitive props', () => {
    const out = transform(`
      function Buy() {
        return <button onClick={x} label="Buy now" count={3} active disabled={false} data={{a:1}}>Go</button>;
      }
    `);
    expect(out).toContain('data-fa-props=');
    // Props are emitted as `data-fa-props={"<escaped json>"}`. Decode the JS
    // string-literal token, then parse the JSON it contains.
    const match = out.match(/data-fa-props=\{("(?:[^"\\]|\\.)*")\}/);
    const jsonText = JSON.parse(match?.[1] ?? '"{}"') as string;
    const decoded = JSON.parse(jsonText) as Record<string, unknown>;
    expect(decoded).toMatchObject({ label: 'Buy now', count: 3, active: true, disabled: false });
    expect(decoded).not.toHaveProperty('data');
    expect(decoded).not.toHaveProperty('onClick');
  });

  it('does not tag non-interactive elements', () => {
    const out = transform(`
      function Card() {
        return <div className="card">hi</div>;
      }
    `);
    expect(out).not.toContain('data-fa-comp');
  });

  it('is idempotent', () => {
    const first = transform(`
      function SaveBar() {
        return <button onClick={save}>Save</button>;
      }
    `);
    const second = transform(first, 'Component.tsx');
    const occurrences = second.match(/data-fa-comp/g) ?? [];
    expect(occurrences.length).toBe(1);
  });

  it('tags expanded interactive tags (input/select/textarea)', () => {
    const out = transform(`
      function Form() {
        return <input value="x" />;
      }
    `);
    expect(out).toContain('data-fa-comp="Form"');
  });

  it('tags role="button" elements', () => {
    const out = transform(`
      function Menu() {
        return <div role="button">Open</div>;
      }
    `);
    expect(out).toContain('data-fa-comp="Menu"');
  });

  it('honors data-fa-ignore opt-out', () => {
    const out = transform(`
      function Hidden() {
        return <button onClick={x} data-fa-ignore>Secret</button>;
      }
    `);
    expect(out).not.toContain('data-fa-comp');
  });

  it('redacts sensitive prop names', () => {
    const out = transform(`
      function Login() {
        return <input onChange={x} name="username" password="literal" />;
      }
    `);
    const match = out.match(/data-fa-props=\{("(?:[^"\\]|\\.)*")\}/);
    const decoded = match ? (JSON.parse(JSON.parse(match[1]) as string) as Record<string, unknown>) : {};
    expect(decoded).not.toHaveProperty('password');
  });

  it('injects data-fa-loc when source location is enabled', () => {
    const result = transformSource(
      `function SaveBar() { return <button onClick={save}>Save</button>; }`,
      'src/SaveBar.tsx',
      { includeSourceLocation: true, rootDir: process.cwd() },
    );
    expect(result?.code).toContain('data-fa-loc=');
  });

  it('resolves names through memo/forwardRef wrappers', () => {
    const out = transform(`
      const Fancy = memo(function () {
        return <button onClick={x}>Go</button>;
      });
    `);
    expect(out).toContain('data-fa-comp="Fancy"');
  });

  it('falls back to a PascalCase filename for anonymous default exports', () => {
    const out = transform(
      `export default function () { return <button onClick={x}>Go</button>; }`,
      'src/Widget.tsx',
    );
    expect(out).toContain('data-fa-comp="Widget"');
  });
});
