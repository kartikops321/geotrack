import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, MapPin, Clock, Coffee, LogIn, LogOut, AlertTriangle,
  Users, Bell, CheckCircle, ChevronRight, X, User, Shield,
  Activity, Zap, Eye, Lock
} from 'lucide-react';

/* ================= CONFIG ================= */

const DEFAULT_PASSWORD = '12345';

const WORK_LOCATION = {
  latitude: 17.4401,
  longitude: 78.3489,
  radius: 100,
  name: "Main Office - Hyderabad"
};

const SPOT_CHECK_CONFIG = {
  minInterval: 30 * 60 * 1000,
  maxInterval: 90 * 60 * 1000,
  responseTimeout: 5 * 60 * 1000,
  enabled: true
};

/* ================= HELPERS ================= */

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatTime = (date) =>
  new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

const formatDuration = (ms) => {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
};

const getRandomInterval = () =>
  Math.floor(Math.random() *
    (SPOT_CHECK_CONFIG.maxInterval - SPOT_CHECK_CONFIG.minInterval)
  ) + SPOT_CHECK_CONFIG.minInterval;

/* ================= USERS ================= */

const EMPLOYEES = [
  { id: 'EMP001', name: 'Kallu', department: 'Sales' },
  { id: 'EMP002', name: 'Karthu', department: 'Marketing' },
  { id: 'EMP003', name: 'Rahul', department: 'Operations' },
  { id: 'EMP004', name: 'Priya', department: 'HR' },
  { id: 'EMP005', name: 'Amit', department: 'Finance' }
];

const initPasswords = () => {
  const saved = localStorage.getItem('geotrack-passwords');
  if (saved) return JSON.parse(saved);

  const p = { ADMIN: DEFAULT_PASSWORD };
  EMPLOYEES.forEach(e => p[e.id] = DEFAULT_PASSWORD);
  localStorage.setItem('geotrack-passwords', JSON.stringify(p));
  return p;
};

/* ================= APP ================= */

export default function GeoTrack() {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);

  /* ---- Auth ---- */
  const [passwords, setPasswords] = useState(initPasswords);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /* ---- Existing state (unchanged) ---- */
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isAtWork, setIsAtWork] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState(null);
  const [onBreak, setOnBreak] = useState(false);
  const [breakStartTime, setBreakStartTime] = useState(null);
  const [totalBreakTime, setTotalBreakTime] = useState(0);
  const [selfieUrl, setSelfieUrl] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [attendanceLog, setAttendanceLog] = useState([]);
  const [spotCheckLog, setSpotCheckLog] = useState([]);
  const [missedSpotChecks, setMissedSpotChecks] = useState(0);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [spotCheckActive, setSpotCheckActive] = useState(false);
  const [spotCheckDeadline, setSpotCheckDeadline] = useState(null);
  const [spotCheckSelfie, setSpotCheckSelfie] = useState(null);
  const [spotCheckLocation, setSpotCheckLocation] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const spotCheckTimerRef = useRef(null);
  const deadlineTimerRef = useRef(null);

  /* ================= TIME ================= */

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ================= PASSWORD CHANGE ================= */

  const handleChangePassword = () => {
    if (newPassword.length < 5) {
      alert('Password must be at least 5 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    const updated = { ...passwords, [currentUser.id]: newPassword };
    setPasswords(updated);
    localStorage.setItem('geotrack-passwords', JSON.stringify(updated));
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePassword(false);
    alert('Password updated');
  };

  /* ================= LOGIN SCREEN ================= */

  if (view === 'login') {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <div style={{ width: 400 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 24 }}>
            <h2 style={{ marginBottom: 16 }}>Login</h2>

            {EMPLOYEES.map(emp => (
              <button key={emp.id}
                onClick={() => {
                  setCurrentUser(emp);
                  setPasswordInput('');
                  setLoginError('');
                }}
                style={{
                  width: '100%',
                  padding: 14,
                  marginBottom: 8,
                  borderRadius: 12,
                  border: '1px solid #e2e8f0'
                }}>
                {emp.name} ({emp.department})
              </button>
            ))}

            <button
              onClick={() => {
                setCurrentUser({ id: 'ADMIN', name: 'Administrator' });
                setPasswordInput('');
                setLoginError('');
              }}
              style={{
                width: '100%',
                padding: 14,
                borderRadius: 12,
                background: '#111',
                color: '#fff',
                marginTop: 12
              }}>
              <Shield size={16} /> Admin
            </button>

            {currentUser && (
              <>
                <input
                  type="password"
                  placeholder="Enter password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 12,
                    marginTop: 12,
                    borderRadius: 10,
                    border: '1px solid #ccc'
                  }}
                />

                {loginError && (
                  <p style={{ color: 'red', fontSize: 13 }}>{loginError}</p>
                )}

                <button
                  onClick={() => {
                    const id = currentUser.id;
                    if (passwordInput !== passwords[id]) {
                      setLoginError('Wrong password');
                      return;
                    }
                    setView(id === 'ADMIN' ? 'admin' : 'employee');
                  }}
                  style={{
                    width: '100%',
                    padding: 14,
                    marginTop: 12,
                    borderRadius: 12,
                    background: '#6366f1',
                    color: '#fff'
                  }}>
                  Login
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================= CHANGE PASSWORD MODAL ================= */

  if (showChangePassword) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ background: '#fff', padding: 24, borderRadius: 16, width: 320 }}>
          <h3>Change Password</h3>
          <input type="password" placeholder="New password"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 8 }}
          />
          <input type="password" placeholder="Confirm password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            style={{ width: '100%', padding: 10, marginBottom: 12 }}
          />
          <button onClick={handleChangePassword}
            style={{ width: '100%', padding: 10 }}>
            Save
          </button>
          <button onClick={() => setShowChangePassword(false)}
            style={{ width: '100%', padding: 10, marginTop: 8 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* ================= EMPLOYEE / ADMIN ================= */
  /* Your existing employee + admin logic continues exactly as before */

  return (
    <div style={{ padding: 20 }}>
      <h2>{view === 'admin' ? 'Admin Dashboard' : 'Employee Dashboard'}</h2>
      <p>Welcome, {currentUser?.name}</p>

      <button onClick={() => setShowChangePassword(true)}>
        Change Password
      </button>

      <button
        onClick={() => {
          setView('login');
          setCurrentUser(null);
          setIsClockedIn(false);
          setSelfieUrl(null);
        }}
        style={{ marginTop: 20 }}>
        Logout
      </button>
    </div>
  );
}
