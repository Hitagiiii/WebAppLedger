import './Navbar.css';

import { IoNotificationsOutline, IoSettingsOutline } from "react-icons/io5";

import userData from './../../mock-data/user.json'
import { TbMoneybag } from "react-icons/tb";

//userData
type userDataSchedma = {
    user:{
        id: number;
        name: string;
        email: string;
        currency: string;
        avatar: React.ReactNode;
    };
    summary:{
        "currentBalance": number;
        "monthlyIncome": number;
        "monthlyExpenses": number;
        "monthlySavings": number;
        "financialHealth": number;
    };
}

type NavItem = {
    userName: string;
    userProfile?: React.ReactNode;
    notifications?: React.ReactNode;
    onSettings?: () => void;
    userBalance: string;
};

export default function Navbar({
    userProfile, 
    notifications, 
}: NavItem) {

    {/*  */}
    const data = userData as userDataSchedma;

    {/*Return*/}
    return (
        <nav className="navbar">
            {/* Navbar Left Content Section */}
            <div className='navbar-left'>
                <div className='navbar-search'>
                    <h3>searchbar here</h3>
                </div>
            </div>

            {/* Navbar Right Content Section */}
            <div className= 'navbar-right'>
                <div className='navbar-balance'>
                    <TbMoneybag className='navbar-balancebag'/>
                    <span>{data.summary.currentBalance}</span>
                </div>
                <div className='navbar-notification'>
                    <IoNotificationsOutline />
                    {notifications}
                </div>
                <div className='navbar-userprofile'>
                    <IoSettingsOutline />
                    {userProfile}
                </div>
            </div>
        </nav>
    );

}
