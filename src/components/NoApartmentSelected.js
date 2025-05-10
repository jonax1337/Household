import React from 'react';
import { FiHome, FiUserPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';

const NoApartmentSelected = ({ component }) => {
  return (
    <div className="container fadeIn">
      <div className="card">
        <div className="no-apartment-container" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
          <div className="sad-emoji" style={{ fontSize: '100px', marginBottom: '20px' }}>😢</div>
          
          <p style={{ fontSize: '16px', marginBottom: '25px', color: 'var(--text-secondary)' }}>
            {component === 'cleaningSchedule' && 'Um den Putzplan zu nutzen, musst du einen Haushalt erstellen oder beitreten.'}
            {component === 'shoppingList' && 'Um die Einkaufsliste zu nutzen, musst du einen Haushalt erstellen oder beitreten.'}
            {component === 'dashboard' && 'Um das Dashboard zu nutzen, musst du einen Haushalt erstellen oder beitreten.'}
            {component === 'finances' && 'Um die Finanzen zu verwalten, musst du einen Haushalt erstellen oder beitreten.'}
            {component === 'roommates' && 'Um Mitbewohner zu verwalten, musst du einen Haushalt erstellen oder beitreten.'}
            {!component && 'Um diese Funktionen zu nutzen, musst du einen Haushalt erstellen oder beitreten.'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default NoApartmentSelected;
