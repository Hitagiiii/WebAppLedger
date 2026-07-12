import './Navbar.css';

type NavItem = {
    userName: string;
    userProfile: React.ReactNode;
    notifications: React.ReactNode;
    onSettings?: () => void;
    userBalance: string;
};

export default function Navbar({
    userName,
    userProfile, 
    notifications, 
    userBalance,
}: NavItem) {

    return (
        <nav className="navbar">
            {/* Navbar Left Content Section */}
            <div className='navbar-left'>
                <div className='navbar-username'>
                    <h3>Welcome back, {userName}!</h3>
                </div>
                <div className='navbar-search'>
                    <h3>searchbar here</h3>
                </div>
            </div>

            {/* Navbar Right Content Section */}
            <div className= 'navbar-right'>
                <div className='navbar-balance'>
                    <span>{userBalance}</span>
                </div>
                <div className='navbar-notification'>
                    {notifications}
                </div>
                <div className='navbar-userprofile'>
                    {userProfile}
                </div>
            </div>
        </nav>
    );

}
