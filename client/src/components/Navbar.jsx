import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";
import "./Navbar.css";

const Navbar = ({ userId, handleLogout }) => {
  const { isDarkMode } = useTheme();

  return (
    <nav className={`navbar ${isDarkMode ? "light" : "dark"}`}>
      <div className="navbar-left">
        <Link to="/games" className="navbar-link">
          x factor games
        </Link>
      </div>
      <div className="navbar-right">
        <Link to="/profile" className="navbar-icon" title="Profile">
          <i className="fas fa-user"></i>
        </Link>
        <button className="navbar-icon logout-button" onClick={handleLogout} title="Logout">
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
