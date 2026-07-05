import Sidebar from "../components/Sidebar/Sidebar";

import './Dashboard.css';

export default function Dashboard() {
  return (
    <div className="dashboard-container">
      {/* Sidebar Column */}
      <div className="dashboard-sidebarsection">
        <Sidebar
        activeItem= 'Dashboard'
        />
      </div>

        {/* Content Column */}
        <div className="dashboard-content">
          {/* Dashboard content goes here */}
        <h1 className="dashboard-content-title">Dashboard</h1>
        <p className="dashboard-content-placeholder"> Component pending implementation. </p>
        </div>

    </div>
  );
}
