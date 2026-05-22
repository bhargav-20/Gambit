import { NavLink } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import clsx from 'clsx';
import { NAV_ITEMS } from './navItems';

/**
 * The collapsible activity sidebar. Single component, two presentations:
 *
 *   desktop (≥lg):   pinned to the left edge as a 56 px icon rail; expanding
 *                    to 224 px when the user explicitly toggles it. Hover-
 *                    open was considered and rejected — too easy to trigger
 *                    accidentally while reaching for the board.
 *
 *   mobile (<lg):    a slide-over from the left edge that occludes the
 *                    content. Opens via the hamburger in the TopBar.
 *
 * The same NAV_ITEMS list drives both presentations so we don't drift.
 */
export function Sidebar() {
  const navOpen = useUiStore((s) => s.navOpen);
  const setNavOpen = useUiStore((s) => s.setNavOpen);

  const closeOnMobile = () => {
    // Always close after picking an item on mobile so the user lands on the
    // new route. On desktop we leave it as-is so they can keep clicking
    // through routes if the rail is pinned open.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setNavOpen(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={clsx(
          'lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity',
          navOpen ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      {/* The rail itself.
              Desktop: takes layout space, width animates between 56 / 224 px.
              Mobile: position:fixed and slides in from the left. */}
      <nav
        className={clsx(
          'border-r border-edge bg-bg-panel backdrop-blur-xl flex flex-col py-3 transition-all duration-200 z-50',
          // Desktop sizing
          'hidden lg:flex',
          navOpen ? 'lg:w-56' : 'lg:w-14',
        )}
        aria-label="Activities"
      >
        <NavList expanded={navOpen} onPick={closeOnMobile} />
        <div className="mt-auto px-2">
          <button
            className="w-full flex items-center justify-center text-ink-muted hover:text-ink rounded-lg py-2 transition-colors"
            onClick={() => setNavOpen(!navOpen)}
            title={navOpen ? 'Collapse' : 'Expand'}
          >
            {navOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </nav>

      {/* Mobile slide-over */}
      <nav
        className={clsx(
          'lg:hidden fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] z-50',
          'border-r border-edge bg-bg-panel backdrop-blur-xl flex flex-col py-3',
          'transition-transform duration-200',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Activities"
        aria-hidden={!navOpen}
      >
        <div className="flex items-center justify-between px-3 pb-2 mb-1 border-b border-edge">
          <span className="font-display text-base">Gambit</span>
          <button
            className="btn-icon h-8 w-8"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={14} />
          </button>
        </div>
        <NavList expanded onPick={closeOnMobile} />
      </nav>
    </>
  );
}

function NavList({ expanded, onPick }: { expanded: boolean; onPick: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map((item) => (
        <li key={item.path}>
          <NavLink
            to={item.path}
            end={item.path === '/'}
            onClick={onPick}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors',
                'min-h-[36px]',                                              // consistent rail height
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-ink-muted hover:bg-bg-subtle hover:text-ink',
                item.comingSoon && 'opacity-50',
              )
            }
            title={item.label + (item.comingSoon ? ' (coming soon)' : '')}
          >
            <span className="shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
            {expanded && (
              <span className="truncate flex-1 flex items-center gap-1.5">
                {item.label}
                {item.comingSoon && (
                  <span className="text-[9px] uppercase tracking-wider text-ink-faint">soon</span>
                )}
              </span>
            )}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
