import { useState } from "react";
import './Sidebar.css';

/* =================================
    TYPES
================================= */
type NavItem = {
    label: string;
    icon: string;
    link: string;
};

type SidebarProps = {
    activeItem?: string;
};

export default function Sidebar({ activeItem }: SidebarProps) {
    const [navItems] = useState<NavItem[]>([
        { label: 'Dashboard', icon: 'dashboard', link: '/dashboard' },
        { label: 'Ledger', icon: 'ledger', link: '/ledger' },
        { label: 'Transactions', icon: 'transactions', link: '/transactions' },
        { label: 'Budget', icon: 'budget', link: '/budget' },
        { label: 'Saving Goals', icon: 'saving-goals', link: '/saving-goals' },
        { label: 'Debt & Loans', icon: 'debt-loans', link: '/debt-loans' },
        { label: 'Analytics', icon: 'analytics', link: '/analytics' },
        { label: 'Calendar', icon: 'calendar', link: '/calendar' },
        { label: 'Settings', icon: 'settings', link: '/settings' },
    ]);

    return (
        <aside className="sidebar">
            <div className="sidebar-user">
                <div className='sidebar-user-wrapper'> 
                <img src='src/assets/avatar/default.jpg' alt="UserAvatar" />
                    <div className="sidebar-user-info">
                        <span className="sidebar-user-name">John Doe</span>
                        <span className="sidebar-user-email"> Student </span>
                    </div>
                </div>
            </div>

            <nav className="sidebar-nav">
                <ul className="sidebar-list">
                    {navItems.map((item) => {
                        const isActive = activeItem === item.label;
                        
                        return (
                            <li key={item.link} className="sidebar-item">
                                <a 
                                    href={item.link} 
                                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                                >
                                    <span className={`icon icon-${item.icon}`} aria-hidden="true" />
                                    <span className="label">{item.label}</span>
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="sidebar-footer">
                <h4>every small saving counts</h4>
            </div>
        </aside>
    );
}
