import React from 'react';
import { Bell, CheckCheck, Clock } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const NotificationsPage = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Bell size={24} color="var(--color-primary)" />
            <span>Official Notifications & Alerts Inbox</span>
          </h1>
          <p className="page-subtitle">Real-time alerts regarding budget disbursements, milestone releases, and CAG notices.</p>
        </div>

        {notifications.length > 0 && (
          <button className="btn btn-secondary" onClick={markAllAsRead}>
            <CheckCheck size={15} />
            <span>Mark All as Read</span>
          </button>
        )}
      </div>

      <div className="card">
        {notifications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notifications.map((n) => (
              <div
                key={n._id}
                onClick={() => !n.read && markAsRead(n._id)}
                style={{
                  background: n.read ? '#FFFFFF' : 'var(--bg-subtle)',
                  border: `1px solid ${n.read ? 'var(--border-color)' : 'var(--color-accent)'}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: n.read ? 'default' : 'pointer'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {!n.read && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)' }} />}
                    <strong style={{ fontSize: '13px', color: 'var(--text-main)' }}>{n.title}</strong>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{n.message}</p>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={12} />
                  <span>{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No new official notifications.
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
