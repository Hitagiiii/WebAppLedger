import Navbar from "../components/Navbar/Navbar";
import Sidebar from "../components/Sidebar/Sidebar";
import StatCard from "../components/StatCard/StatCard";
import UserCard from "../components/UserCard/UserCard";
import ReChartsPlaceholder from "./../components/ReChartsPlaceholder/ReChartsPlaceholder"

import { GrStatusPlaceholder } from "react-icons/gr";

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
        <div className="dashboard-content-column">
        
          {/* Navbar */}
          <section className="dashboard-navbar">
            <Navbar
              userName= "userName"
              userBalance= ""
            />
          </section>
          

          {/* Dashboard content goes here */}
          <section className="dashboard-contentsection">
            
            {/* UserCard */}
            <section className="dashboard-usercard">
              <UserCard/>
            </section>

            {/* StatCard */}
            <section className="dashboard-statcard">
              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />

              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />

              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />

              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />

              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />

              <StatCard
              icon = {<GrStatusPlaceholder />}
              label ='label placeholder'
              value = 'value'
              analysis= 'analysis'
              />
            </section>
            
            <section className="dashboard-graphs">
              <div className="dashboard-graphs-left">
                <ReChartsPlaceholder/>
              </div>
              <div className="dashboard-graphs-right">
                <ReChartsPlaceholder/>
              </div>
            </section>


          </section>
        </div>

    </div>
  );
}
