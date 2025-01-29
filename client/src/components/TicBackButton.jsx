import React from "react";
import { useNavigate } from "react-router-dom";
import "./TicBackButton.css";

const TicBackButton = () => {
  const navigate = useNavigate();

  return (
    <div className="tic-back-button-container">
      <button className="tic-back-button" onClick={() => navigate("/games")}>
        ↩
      </button>
    </div>
  );
};

export default TicBackButton;
