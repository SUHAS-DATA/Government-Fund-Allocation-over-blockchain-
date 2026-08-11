import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div style={{ maxWidth: '500px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
      <div style={{ fontSize: '48px', fontWeight: '800', color: 'var(--color-primary)' }}>404</div>
      <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-main)', margin: '8px 0 12px 0' }}>
        Page Not Found
      </h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        The government resource or page you requested does not exist or has been relocated.
      </p>
      <Link to="/" className="btn btn-primary">
        Return to Portal Homepage
      </Link>
    </div>
  );
};

export default NotFoundPage;
