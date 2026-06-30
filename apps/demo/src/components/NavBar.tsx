import { useRouter } from '../router.js';

const LINKS: { href: string; label: string }[] = [
  { href: '/', label: 'Home' },
  { href: '/products', label: 'Products' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/settings', label: 'Settings' },
];

/**
 * Top navigation. Each link is an `<a>` (auto-tagged) that emits a `click` and
 * triggers an SPA `pushState`, which the SDK turns into a `page_view` with the
 * destination `url_path`.
 */
export function NavBar() {
  const { path, navigate } = useRouter();
  return (
    <nav className="navbar">
      <div className="brand">
        <span className="brand-dot" />
        FiberShop
      </div>
      <div className="nav-links">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            label={`nav-${link.label.toLowerCase()}`}
            className={`nav-link ${path === link.href ? 'active' : ''}`}
            onClick={(e) => {
              e.preventDefault();
              navigate(link.href);
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
