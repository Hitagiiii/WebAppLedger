import { useState } from "react";
import './Sidebar.css';

import { MdOutlineDashboard, } from "react-icons/md";
import { IoBookOutline } from "react-icons/io5";
import { GrTransaction } from "react-icons/gr";
import { LuWallet, LuGoal } from "react-icons/lu";
import { SiSimpleanalytics } from "react-icons/si";
import { FaRegCalendarAlt } from "react-icons/fa";
import { CiSettings } from "react-icons/ci";







/* =================================
    TYPES
================================= */
type NavItem = {
    label: string;
    icon: React.ReactNode;
    link: string;
};

type SidebarProps = {
    activeItem?: string;
};

export default function Sidebar({ activeItem }: SidebarProps) {
    const [navItems] = useState<NavItem[]>([
        { label: 'Dashboard', icon: <MdOutlineDashboard />, link: '/dashboard' },
        { label: 'Ledger', icon: <IoBookOutline />, link: '/ledger' },
        { label: 'Transactions', icon: <GrTransaction />, link: '/transactions' },
        { label: 'Budget', icon: <LuWallet />, link: '/budget' },
        { label: 'Debt & Loans', icon: <LuGoal />, link: '/debt-loans' },
        { label: 'Analytics', icon: <SiSimpleanalytics />, link: '/analytics' },
        { label: 'Calendar', icon: <FaRegCalendarAlt />, link: '/calendar' },
        { label: 'Settings', icon: <CiSettings />, link: '/settings' },
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
                                    <span className="icon">{item.icon}</span>
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
