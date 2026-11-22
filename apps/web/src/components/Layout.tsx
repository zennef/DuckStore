import type { ComponentType, SVGProps } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { CartIcon, HomeIcon } from './icons';

const NAV_ITEMS: { to: string; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { to: '/warehouse', label: 'Warehouse', Icon: HomeIcon },
  { to: '/store', label: 'Store', Icon: CartIcon },
];

/** App frame from the mockup: top bar, sidebar navigation, and the routed page. */
export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <p className="text-lg font-semibold">Duck Store Platform</p>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Main"
          className="border-b border-gray-200 bg-white p-3 md:w-56 md:shrink-0 md:border-r md:border-b-0"
        >
          <ul className="flex gap-1 md:flex-col">
            {NAV_ITEMS.map(({ to, label, Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                      isActive
                        ? 'bg-blue-50 font-medium text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
