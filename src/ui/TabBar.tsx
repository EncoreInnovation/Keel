/** Bottom navigation for the four top-level screens. Hidden inside workout flows. */

export type Tab = 'today' | 'recover' | 'progressHub' | 'more';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '◉' },
  { id: 'recover', label: 'Recover', icon: '◌' },
  { id: 'progressHub', label: 'Progress', icon: '▲' },
  { id: 'more', label: 'More', icon: '⋯' },
];

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`tab-bar__tab${t.id === active ? ' tab-bar__tab--active' : ''}`}
          aria-current={t.id === active ? 'page' : undefined}
          onClick={() => onSelect(t.id)}
        >
          <span className="tab-bar__icon" aria-hidden="true">
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
