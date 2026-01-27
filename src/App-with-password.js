import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, Clock, Coffee, LogIn, LogOut, AlertTriangle, Users, Bell, CheckCircle, ChevronRight, X, User, Shield, Activity, Zap, Eye, Lock, Key } from 'lucide-react';

// Work location config - UPDATE THESE TO YOUR OFFICE COORDINATES
const WORK_LOCATION = {
  latitude: 17.4401,
  longitude: 78.3489,
  radius: 100,
  name: "Main Office - Hyderabad"
};

// Spot check settings
const SPOT_CHECK_CONFIG = {
  minInterval: 30 * 60 * 1000,
  maxInterval: 90 * 60 * 1000,
  responseTimeout: 5 * 60 * 1000,
  enabled: true
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatTime = (date) => new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

const formatDuration = (ms) => {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const getRandomInterval = () => Math.floor(Math.random() * (SPOT_CHECK_CONFIG.maxInterval - SPOT_CHECK_CONFIG.minInterval)) + SPOT_CHECK_CONFIG.minInterval;

// Initial employee data with passwords
const INITIAL_EMPLOYEES = [
  { id: 'EMP001', name: 'Kallu', department: 'Sales', phone: '+91 98765 43210', password: '12345' },
  { id: 'EMP002', name: 'Karthu', department: 'Marketing', phone: '+91 98765 43211', password: '12345' },
  { id: 'EMP003', name: 'Rahul', department: 'Operations', phone: '+91 98765 43212', password: '12345' },
  { id: 'EMP004', name: 'Priya', department: 'HR', phone: '+91 98765 43213', password: '12345' },
  { id: 'EMP005', name: 'Amit', department: 'Finance', phone: '+91 98765 43214', password: '12345' },
];

// Admin credentials
const INITIAL_ADMIN = { id: 'ADMIN', name: 'Administrator', password: '12345' };

export default function GeoTrack() {
  // Load saved data from localStorage
  const [employees, setEmployees] = useState(() => {
    const saved = localStorage.getItem('geotrack_employees');
    return saved ? JSON.parse(saved) : INITIAL_EMPLOYEES;
  });
  
  const [adminCredentials, setAdminCredentials] = useState(() => {
    const saved = localStorage.getItem('geotrack_admin');
    return saved ? JSON.parse(saved) : INITIAL_ADMIN;
  });

  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [spotCheckActive, setSpotCheckActive] = useState(false);
  const [spotCheckDeadline, setSpotCheckDeadline] = useState(null);
  const [spotCheckSelfie, setSpotCheckSelfie] = useState(null);
  const [spotCheckLocation, setSpotCheckLocation] = useState(null);
  const [missedSpotChecks, setMissedSpotChecks] = useState(0);
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const spotCheckTimerRef = useRef(null);
  const deadlineTimerRef = useRef(null);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('geotrack_employees', JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem('geotrack_admin', JSON.stringify(adminCredentials));
  }, [adminCredentials]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const triggerSpotCheck = useCallback(() => {
    setSpotCheckActive(true);
    setSpotCheckDeadline(Date.now() + SPOT_CHECK_CONFIG.responseTimeout);
    setSpotCheckSelfie(null);
    setSpotCheckLocation(null);
    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+Zk4yCfHZ4foSLj46LhoF9e3+FjJGTkY2Ifnt5fICGi46NiYR+eXd4fICEh4eGg398eXl7foKFh4eGhIF+fHt8f4KFh4eHhYOAfn19f4KEhoaGhYOBf35+f4GDhYaGhYSCgH9+fn+BgYOEhISEg4KBgH9/f4CBgoODg4OCgYGAgICAgIGBgoKCgoGBgYGAgICAgYGBgYGBgYGBgYGAgA==').play().catch(() => {}); } catch (e) {}
  }, []);

  const handleMissedSpotCheck = useCallback(() => {
    setMissedSpotChecks(prev => prev + 1);
    setSpotCheckActive(false);
    setAlerts(prev => [{ id: Date.now(), type: 'spot-check-missed', message: `${currentUser?.name} missed spot check`, time: new Date(), visibleTo: currentUser?.id, severity: 'high' }, ...prev]);
    setSpotCheckLog(prev => [{ id: Date.now(), visibleTo: currentUser?.id, visibleToName: currentUser?.name, type: 'spot-check-missed', time: new Date(), status: 'missed' }, ...prev]);
  }, [currentUser]);

  const scheduleNextSpotCheck = useCallback(() => {
    if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    const interval = getRandomInterval();
    spotCheckTimerRef.current = setTimeout(() => {
      if (isClockedIn && !onBreak) triggerSpotCheck();
    }, interval);
  }, [isClockedIn, onBreak, triggerSpotCheck]);

  useEffect(() => {
    if (spotCheckActive) {
      deadlineTimerRef.current = setTimeout(() => {
        if (spotCheckActive && !spotCheckSelfie) handleMissedSpotCheck();
        scheduleNextSpotCheck();
      }, SPOT_CHECK_CONFIG.responseTimeout);
    }
    return () => { if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current); };
  }, [spotCheckActive, spotCheckSelfie, handleMissedSpotCheck, scheduleNextSpotCheck]);

  useEffect(() => {
    if (isClockedIn && !onBreak && SPOT_CHECK_CONFIG.enabled) {
      scheduleNextSpotCheck();
    } else {
      if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    }
    return () => { if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current); };
  }, [isClockedIn, onBreak, scheduleNextSpotCheck]);

  useEffect(() => {
    if (view === 'employee' && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setLocation({ latitude, longitude, accuracy });
          setLocationError(null);
          const distance = calculateDistance(latitude, longitude, WORK_LOCATION.latitude, WORK_LOCATION.longitude);
          const wasAtWork = isAtWork;
          const nowAtWork = distance <= WORK_LOCATION.radius;
          setIsAtWork(nowAtWork);
          if (wasAtWork && !nowAtWork && isClockedIn && !onBreak) {
            setAlerts(prev => [{ id: Date.now(), type: 'location', message: `${currentUser?.name} left work location`, time: new Date(), visibleTo: currentUser?.id, severity: 'high' }, ...prev]);
          }
        },
        (error) => setLocationError(error.message),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [view, isClockedIn, onBreak, isAtWork, currentUser]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setShowCamera(true);
    } catch (err) { alert('Camera access denied.'); }
  };

  const capturePhoto = (isSpotCheck = false) => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
      ctx.fillStyle = 'white';
      ctx.font = '14px monospace';
      ctx.fillText(`${new Date().toLocaleString('en-IN')} | Lat: ${location?.latitude?.toFixed(5)} Lng: ${location?.longitude?.toFixed(5)}`, 10, canvas.height - 18);
      const dataUrl = canvas.toDataURL('image/jpeg');
      if (isSpotCheck) { setSpotCheckSelfie(dataUrl); setSpotCheckLocation({ ...location }); }
      else { setSelfieUrl(dataUrl); }
      stopCamera();
    }
  };

  const stopCamera = () => { if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop()); setShowCamera(false); };

  const submitSpotCheck = () => {
    if (!spotCheckSelfie) { alert('Please take a selfie first!'); return; }
    if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    const isLocationValid = spotCheckLocation && calculateDistance(spotCheckLocation.latitude, spotCheckLocation.longitude, WORK_LOCATION.latitude, WORK_LOCATION.longitude) <= WORK_LOCATION.radius;
    setSpotCheckLog(prev => [{ id: Date.now(), visibleTo: currentUser?.id, visibleToName: currentUser?.name, type: 'spot-check', time: new Date(), selfie: spotCheckSelfie, location: spotCheckLocation, locationValid: isLocationValid, status: isLocationValid ? 'verified' : 'location-mismatch' }, ...prev]);
    if (!isLocationValid) {
      setAlerts(prev => [{ id: Date.now(), type: 'spot-check-location', message: `${currentUser?.name} spot check outside work area`, time: new Date(), visibleTo: currentUser?.id, severity: 'high', selfie: spotCheckSelfie }, ...prev]);
    }
    setSpotCheckActive(false);
    setSpotCheckSelfie(null);
    scheduleNextSpotCheck();
  };

  const handleClockIn = () => {
    if (!location) { alert('Enable location services.'); return; }
    if (!isAtWork) { alert('Must be at work location.'); return; }
    if (!selfieUrl) { alert('Take a selfie first.'); return; }
    setIsClockedIn(true);
    setClockInTime(new Date());
    setMissedSpotChecks(0);
    setAttendanceLog(prev => [{ id: Date.now(), visibleTo: currentUser.id, visibleToName: currentUser.name, type: 'clock-in', time: new Date(), location: { ...location }, selfie: selfieUrl }, ...prev]);
  };

  const handleClockOut = () => {
    if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    setSpotCheckActive(false);
    setAttendanceLog(prev => [{ id: Date.now(), visibleTo: currentUser.id, visibleToName: currentUser.name, type: 'clock-out', time: new Date(), location: { ...location }, totalWorkTime: new Date() - clockInTime - totalBreakTime, totalBreakTime, missedSpotChecks }, ...prev]);
    setIsClockedIn(false);
    setClockInTime(null);
    setTotalBreakTime(0);
    setSelfieUrl(null);
    setMissedSpotChecks(0);
  };

  const startBreak = () => {
    setOnBreak(true);
    setBreakStartTime(new Date());
    if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    setAttendanceLog(prev => [{ id: Date.now(), visibleTo: currentUser.id, visibleToName: currentUser.name, type: 'break-start', time: new Date(), location: { ...location } }, ...prev]);
  };

  const endBreak = () => {
    const breakDuration = new Date() - breakStartTime;
    setTotalBreakTime(prev => prev + breakDuration);
    setOnBreak(false);
    setBreakStartTime(null);
    setAttendanceLog(prev => [{ id: Date.now(), visibleTo: currentUser.id, visibleToName: currentUser.name, type: 'break-end', time: new Date(), location: { ...location }, breakDuration }, ...prev]);
  };

  // Login handlers
  const handleEmployeeSelect = (emp) => {
    setSelectedEmployee(emp);
    setPasswordInput('');
    setLoginError('');
  };

  const handleEmployeeLogin = () => {
    if (!passwordInput) {
      setLoginError('Please enter password');
      return;
    }
    const emp = employees.find(e => e.id === selectedEmployee.id);
    if (emp && emp.password === passwordInput) {
      setCurrentUser(emp);
      setView('employee');
      setSelectedEmployee(null);
      setPasswordInput('');
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };

  const handleAdminLogin = () => {
    if (!passwordInput) {
      setLoginError('Please enter password');
      return;
    }
    if (passwordInput === adminCredentials.password) {
      setCurrentUser(adminCredentials);
      setView('admin');
      setSelectedEmployee(null);
      setPasswordInput('');
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };

  // Change password handler
  const handleChangePassword = () => {
    setPasswordChangeError('');
    setPasswordChangeSuccess('');
    
    if (!newPassword || !confirmPassword) {
      setPasswordChangeError('Please fill all fields');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordChangeError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordChangeError('Passwords do not match');
      return;
    }
    
    if (view === 'admin') {
      setAdminCredentials(prev => ({ ...prev, password: newPassword }));
    } else {
      setEmployees(prev => prev.map(emp => 
        emp.id === currentUser.id ? { ...emp, password: newPassword } : emp
      ));
      setCurrentUser(prev => ({ ...prev, password: newPassword }));
    }
    
    setPasswordChangeSuccess('Password changed successfully!');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setShowChangePassword(false);
      setPasswordChangeSuccess('');
    }, 2000);
  };

  const handleLogout = () => {
    setView('login');
    setCurrentUser(null);
    setSelfieUrl(null);
    setIsClockedIn(false);
    setShowChangePassword(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f5f7fa; }
    input { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
  `;

  // SPOT CHECK MODAL
  if (spotCheckActive && view === 'employee') {
    const timeRemaining = Math.max(0, spotCheckDeadline - currentTime);
    const isUrgent = timeRemaining < 60000;
    return (
      <div style={{ minHeight: '100vh', background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <style>{styles}</style>
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: isUrgent ? '#fee2e2' : '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Eye style={{ width: 32, height: 32, color: isUrgent ? '#dc2626' : '#f59e0b' }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8 }}>🚨 Spot Check!</h2>
            <p style={{ color: '#666', fontSize: 14 }}>Take a LIVE selfie to verify your presence</p>
          </div>
          <div style={{ textAlign: 'center', padding: 20, borderRadius: 16, background: isUrgent ? '#fef2f2' : '#fffbeb', marginBottom: 24 }}>
            <p style={{ color: '#666', fontSize: 12, marginBottom: 4 }}>Time Remaining</p>
            <p style={{ fontSize: 36, fontWeight: 700, color: isUrgent ? '#dc2626' : '#f59e0b', fontFamily: 'monospace' }}>{formatDuration(timeRemaining)}</p>
          </div>
          {showCamera ? (
            <div>
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 16 }}>
                <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => capturePhoto(true)} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer' }}>📸 Capture</button>
                <button onClick={stopCamera} style={{ padding: 14, borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
              </div>
            </div>
          ) : spotCheckSelfie ? (
            <div>
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                <img src={spotCheckSelfie} alt="Selfie" style={{ width: '100%', display: 'block' }} />
                <div style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px', borderRadius: 20, background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle style={{ width: 14, height: 14 }} /> Ready</div>
              </div>
              <div style={{ padding: 12, borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, background: isAtWork ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isAtWork ? '#bbf7d0' : '#fecaca'}` }}>
                <MapPin style={{ width: 20, height: 20, color: isAtWork ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontWeight: 600, color: isAtWork ? '#22c55e' : '#ef4444' }}>{isAtWork ? '✓ At Work Location' : '✗ Outside Work Area!'}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => { setSpotCheckSelfie(null); startCamera(); }} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Retake</button>
                <button onClick={submitSpotCheck} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><CheckCircle style={{ width: 18, height: 18 }} /> Submit</button>
              </div>
            </div>
          ) : (
            <button onClick={startCamera} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #f59e0b, #ea580c)', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Camera style={{ width: 20, height: 20 }} /> Take Live Selfie</button>
          )}
          <p style={{ textAlign: 'center', color: '#ef4444', fontSize: 13, marginTop: 20, fontWeight: 500 }}>⚠️ Missing this check will alert your manager!</p>
        </div>
      </div>
    );
  }

  // CHANGE PASSWORD MODAL
  if (showChangePassword) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{styles}</style>
        <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Key style={{ width: 32, height: 32, color: '#8b5cf6' }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#111', marginBottom: 8 }}>Change Password</h2>
            <p style={{ color: '#666', fontSize: 14 }}>Enter your new password</p>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151', fontSize: 14 }}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 16, outline: 'none' }}
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151', fontSize: 14 }}>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 16, outline: 'none' }}
            />
          </div>
          
          {passwordChangeError && (
            <div style={{ padding: 12, borderRadius: 12, background: '#fef2f2', marginBottom: 16 }}>
              <p style={{ color: '#dc2626', fontSize: 14, margin: 0 }}>{passwordChangeError}</p>
            </div>
          )}
          
          {passwordChangeSuccess && (
            <div style={{ padding: 12, borderRadius: 12, background: '#f0fdf4', marginBottom: 16 }}>
              <p style={{ color: '#22c55e', fontSize: 14, margin: 0 }}>{passwordChangeSuccess}</p>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => { setShowChangePassword(false); setNewPassword(''); setConfirmPassword(''); setPasswordChangeError(''); }} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleChangePassword} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN WITH PASSWORD
  if (view === 'login') {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{styles}</style>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', backdropFilter: 'blur(10px)' }}>
              <MapPin style={{ width: 40, height: 40, color: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 36, fontWeight: 700, color: '#fff', marginBottom: 8 }}>GeoTrack</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }}>Employee Attendance & Location Monitor</p>
          </div>
          
          {!selectedEmployee ? (
            <>
              <div style={{ background: '#fff', borderRadius: 24, padding: 24, marginBottom: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1e293b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User style={{ width: 20, height: 20, color: '#6366f1' }} /> Employee Login
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {employees.map(emp => (
                    <button key={emp.id} onClick={() => handleEmployeeSelect(emp)} style={{ width: '100%', padding: 16, borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.2s' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600, fontSize: 18 }}>{emp.name.charAt(0)}</div>
                        <div style={{ textAlign: 'left' }}>
                          <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>{emp.name}</p>
                          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>{emp.department}</p>
                        </div>
                      </div>
                      <ChevronRight style={{ width: 20, height: 20, color: '#94a3b8' }} />
                    </button>
                  ))}
                </div>
              </div>
              
              <button onClick={() => setSelectedEmployee({ isAdmin: true })} style={{ width: '100%', padding: 16, borderRadius: 16, border: 'none', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Shield style={{ width: 20, height: 20 }} /> Admin Dashboard
              </button>
            </>
          ) : (
            <div style={{ background: '#fff', borderRadius: 24, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
              <button onClick={() => { setSelectedEmployee(null); setPasswordInput(''); setLoginError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#6366f1', fontWeight: 500, cursor: 'pointer', marginBottom: 20, padding: 0 }}>
                <ChevronRight style={{ width: 18, height: 18, transform: 'rotate(180deg)' }} /> Back
              </button>
              
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: selectedEmployee.isAdmin ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#fff', fontWeight: 700, fontSize: 28 }}>
                  {selectedEmployee.isAdmin ? <Shield style={{ width: 36, height: 36 }} /> : selectedEmployee.name?.charAt(0)}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>{selectedEmployee.isAdmin ? 'Admin Login' : selectedEmployee.name}</h2>
                {!selectedEmployee.isAdmin && <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>{selectedEmployee.department}</p>}
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 500, color: '#374151', fontSize: 14 }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }}
                    onKeyPress={(e) => e.key === 'Enter' && (selectedEmployee.isAdmin ? handleAdminLogin() : handleEmployeeLogin())}
                    placeholder="Enter your password"
                    style={{ width: '100%', padding: '14px 48px 14px 14px', borderRadius: 12, border: `1px solid ${loginError ? '#fecaca' : '#e2e8f0'}`, fontSize: 16, outline: 'none' }}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <Eye style={{ width: 20, height: 20, color: '#94a3b8' }} />
                  </button>
                </div>
              </div>
              
              {loginError && (
                <div style={{ padding: 12, borderRadius: 12, background: '#fef2f2', marginBottom: 16 }}>
                  <p style={{ color: '#dc2626', fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AlertTriangle style={{ width: 16, height: 16 }} /> {loginError}
                  </p>
                </div>
              )}
              
              <button onClick={selectedEmployee.isAdmin ? handleAdminLogin : handleEmployeeLogin} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: selectedEmployee.isAdmin ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', fontWeight: 600, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Lock style={{ width: 20, height: 20 }} /> Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EMPLOYEE VIEW - LIGHT THEME
  if (view === 'employee') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <style>{styles}</style>
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>{currentUser?.name?.charAt(0)}</div>
              <div>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>{currentUser?.name}</p>
                <p style={{ color: '#64748b', fontSize: 13, margin: 0, fontFamily: 'monospace' }}>{currentUser?.id}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowChangePassword(true)} style={{ padding: 10, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer' }} title="Change Password">
                <Key style={{ width: 20, height: 20, color: '#64748b' }} />
              </button>
              <button onClick={handleLogout} style={{ padding: 10, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <LogOut style={{ width: 20, height: 20, color: '#64748b' }} />
              </button>
            </div>
          </div>
        </header>
        
        <main style={{ maxWidth: 500, margin: '0 auto', padding: 20 }}>
          {/* Time Display */}
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ fontSize: 48, fontWeight: 700, color: '#1e293b', fontFamily: 'monospace', margin: 0 }}>{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            <p style={{ color: '#64748b', marginTop: 8 }}>{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>

          {/* Location Status */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, border: `2px solid ${isAtWork ? '#bbf7d0' : '#fecaca'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: isAtWork ? '#f0fdf4' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MapPin style={{ width: 28, height: 28, color: isAtWork ? '#22c55e' : '#ef4444' }} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Location Status</p>
                <p style={{ color: isAtWork ? '#22c55e' : '#ef4444', fontSize: 14, margin: '4px 0 0', fontWeight: 500 }}>{location ? (isAtWork ? '✓ At Work Location' : '✗ Outside Work Area') : locationError || 'Detecting...'}</p>
              </div>
              {location && <div style={{ textAlign: 'right' }}><p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Accuracy</p><p style={{ color: '#1e293b', fontWeight: 600, margin: 0, fontFamily: 'monospace' }}>{Math.round(location.accuracy)}m</p></div>}
            </div>
          </div>

          {/* Selfie Section - Only show when not clocked in */}
          {!isClockedIn && (
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera style={{ width: 24, height: 24, color: '#8b5cf6' }} /></div>
                <div><p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Selfie Verification</p><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Required for clock-in</p></div>
              </div>
              {showCamera ? (
                <div>
                  <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 16 }}>
                    <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => capturePhoto(false)} style={{ flex: 1, padding: 14, borderRadius: 12, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Capture</button>
                    <button onClick={stopCamera} style={{ padding: 14, borderRadius: 12, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}><X style={{ width: 20, height: 20, color: '#64748b' }} /></button>
                  </div>
                </div>
              ) : selfieUrl ? (
                <div>
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                    <img src={selfieUrl} alt="Selfie" style={{ width: '100%', display: 'block' }} />
                    <div style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px', borderRadius: 20, background: '#22c55e', color: '#fff', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle style={{ width: 14, height: 14 }} /> Captured</div>
                  </div>
                  <button onClick={() => { setSelfieUrl(null); startCamera(); }} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Retake Photo</button>
                </div>
              ) : (
                <button onClick={startCamera} style={{ width: '100%', padding: 16, borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Camera style={{ width: 20, height: 20 }} /> Open Camera</button>
              )}
            </div>
          )}

          {/* Clock In/Out */}
          {!isClockedIn ? (
            <button onClick={handleClockIn} disabled={!isAtWork || !selfieUrl} style={{ width: '100%', padding: 20, borderRadius: 16, border: 'none', background: isAtWork && selfieUrl ? 'linear-gradient(135deg, #22c55e, #16a34a)' : '#e2e8f0', color: isAtWork && selfieUrl ? '#fff' : '#94a3b8', fontWeight: 700, fontSize: 18, cursor: isAtWork && selfieUrl ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: isAtWork && selfieUrl ? '0 8px 24px rgba(34,197,94,0.4)' : 'none' }}><LogIn style={{ width: 24, height: 24 }} /> Clock In</button>
          ) : (
            <div>
              {/* Working Timer */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Clock style={{ width: 24, height: 24, color: '#22c55e' }} /></div>
                    <div><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Working Since</p><p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>{formatTime(clockInTime)}</p></div>
                  </div>
                  <div style={{ textAlign: 'right' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Duration</p><p style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', margin: 0, fontFamily: 'monospace' }}>{formatDuration(currentTime - clockInTime - totalBreakTime)}</p></div>
                </div>
              </div>

              {/* Spot Check Info */}
              {!onBreak && (
                <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #e9d5ff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Eye style={{ width: 20, height: 20, color: '#8b5cf6' }} /></div>
                      <div><p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: 14 }}>Random Spot Checks</p><p style={{ color: '#8b5cf6', fontSize: 13, margin: 0 }}>Active • Be ready</p></div>
                    </div>
                    <button onClick={triggerSpotCheck} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#f5f3ff', color: '#8b5cf6', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Zap style={{ width: 14, height: 14 }} /> Test</button>
                  </div>
                </div>
              )}

              {/* Missed Checks Warning */}
              {missedSpotChecks > 0 && (
                <div style={{ background: '#fef2f2', borderRadius: 16, padding: 16, marginBottom: 16, border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <AlertTriangle style={{ width: 24, height: 24, color: '#ef4444' }} />
                    <div><p style={{ fontWeight: 600, color: '#ef4444', margin: 0 }}>Missed Spot Checks: {missedSpotChecks}</p><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Reported to admin</p></div>
                  </div>
                </div>
              )}

              {/* Break Button */}
              {!onBreak ? (
                <button onClick={startBreak} style={{ width: '100%', padding: 16, borderRadius: 16, border: '2px solid #fbbf24', background: '#fffbeb', color: '#b45309', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}><Coffee style={{ width: 20, height: 20 }} /> Start Break</button>
              ) : (
                <div style={{ background: '#fffbeb', borderRadius: 16, padding: 20, marginBottom: 16, border: '2px solid #fbbf24' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Coffee style={{ width: 24, height: 24, color: '#f59e0b' }} /><div><p style={{ fontWeight: 600, color: '#b45309', margin: 0 }}>On Break</p><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Since {formatTime(breakStartTime)}</p></div></div>
                    <p style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', margin: 0, fontFamily: 'monospace' }}>{formatDuration(currentTime - breakStartTime)}</p>
                  </div>
                  <button onClick={endBreak} style={{ width: '100%', padding: 14, borderRadius: 12, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>End Break</button>
                </div>
              )}

              {/* Clock Out */}
              <button onClick={handleClockOut} style={{ width: '100%', padding: 20, borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontWeight: 700, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 8px 24px rgba(239,68,68,0.4)', marginBottom: 16 }}><LogOut style={{ width: 24, height: 24 }} /> Clock Out</button>

              {/* Summary */}
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 16px' }}>Today's Summary</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, textAlign: 'center' }}><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Work</p><p style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '4px 0 0', fontFamily: 'monospace' }}>{formatDuration(currentTime - clockInTime - totalBreakTime)}</p></div>
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, textAlign: 'center' }}><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Break</p><p style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '4px 0 0', fontFamily: 'monospace' }}>{formatDuration(totalBreakTime + (onBreak ? currentTime - breakStartTime : 0))}</p></div>
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, textAlign: 'center' }}><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Missed</p><p style={{ fontSize: 20, fontWeight: 700, color: missedSpotChecks > 0 ? '#ef4444' : '#22c55e', margin: '4px 0 0', fontFamily: 'monospace' }}>{missedSpotChecks}</p></div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ADMIN DASHBOARD - LIGHT THEME
  if (view === 'admin') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
        <style>{styles}</style>
        
        {/* Mobile Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #f59e0b, #ea580c)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Shield style={{ width: 20, height: 20, color: '#fff' }} /></div>
              <div><p style={{ fontWeight: 700, color: '#1e293b', margin: 0 }}>GeoTrack</p><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>Admin Panel</p></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={{ position: 'relative', padding: 10, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}>
                <Bell style={{ width: 20, height: 20, color: '#64748b' }} />
                {alerts.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alerts.length}</span>}
              </button>
              <button onClick={() => setShowChangePassword(true)} style={{ padding: 10, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer' }} title="Change Password">
                <Key style={{ width: 20, height: 20, color: '#64748b' }} />
              </button>
              <button onClick={handleLogout} style={{ padding: 10, borderRadius: 10, border: 'none', background: '#f1f5f9', cursor: 'pointer' }}><LogOut style={{ width: 20, height: 20, color: '#64748b' }} /></button>
            </div>
          </div>
        </header>

        <main style={{ padding: 20 }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Users style={{ width: 22, height: 22, color: '#3b82f6' }} /></div>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 }}>{employees.length}</p>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Employees</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><CheckCircle style={{ width: 22, height: 22, color: '#22c55e' }} /></div>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 }}>{attendanceLog.filter(l => l.type === 'clock-in').length}</p>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Clocked In</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Eye style={{ width: 22, height: 22, color: '#8b5cf6' }} /></div>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 }}>{spotCheckLog.filter(l => l.status === 'verified').length}</p>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Checks OK</p>
            </div>
            <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><AlertTriangle style={{ width: 22, height: 22, color: '#ef4444' }} /></div>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 }}>{alerts.length}</p>
              <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Alerts</p>
            </div>
          </div>

          {/* Alerts */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle style={{ width: 20, height: 20, color: '#ef4444' }} /> Alerts</h3>
              {alerts.length > 0 && <button onClick={() => setAlerts([])} style={{ color: '#64748b', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>}
            </div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}><CheckCircle style={{ width: 48, height: 48, color: '#22c55e', margin: '0 auto 12px' }} /><p style={{ color: '#64748b' }}>No alerts</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{alerts.slice(0, 5).map(alert => (
                <div key={alert.id} style={{ padding: 16, borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <AlertTriangle style={{ width: 18, height: 18, color: '#ef4444', flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}><p style={{ color: '#1e293b', fontWeight: 500, margin: 0, fontSize: 14 }}>{alert.message}</p><p style={{ color: '#64748b', fontSize: 12, margin: '4px 0 0' }}>{formatTime(alert.time)}</p></div>
                  </div>
                </div>
              ))}</div>
            )}
          </div>

          {/* Activity Log */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}><Activity style={{ width: 20, height: 20, color: '#3b82f6' }} /> Activity Log</h3>
            {attendanceLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32 }}><Clock style={{ width: 48, height: 48, color: '#94a3b8', margin: '0 auto 12px' }} /><p style={{ color: '#64748b' }}>No activity yet</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{attendanceLog.slice(0, 10).map(log => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: '#f8fafc' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: log.type === 'clock-in' ? '#f0fdf4' : log.type === 'clock-out' ? '#fef2f2' : '#fffbeb' }}>
                    {log.type === 'clock-in' && <LogIn style={{ width: 18, height: 18, color: '#22c55e' }} />}
                    {log.type === 'clock-out' && <LogOut style={{ width: 18, height: 18, color: '#ef4444' }} />}
                    {(log.type === 'break-start' || log.type === 'break-end') && <Coffee style={{ width: 18, height: 18, color: '#f59e0b' }} />}
                  </div>
                  <div style={{ flex: 1 }}><p style={{ fontWeight: 500, color: '#1e293b', margin: 0, fontSize: 14 }}>{log.visibleToName}</p><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{log.type.replace('-', ' ')}</p></div>
                  <p style={{ color: '#94a3b8', fontSize: 12, fontFamily: 'monospace' }}>{formatTime(log.time)}</p>
                </div>
              ))}</div>
            )}
          </div>

          {/* Employees */}
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontWeight: 600, color: '#1e293b', margin: '0 0 16px' }}>Employees</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>{employees.map(emp => {
              const lastLog = attendanceLog.find(l => l.visibleTo === emp.id);
              const isWorking = lastLog && ['clock-in', 'break-start', 'break-end'].includes(lastLog.type);
              const isOnBreak = lastLog?.type === 'break-start';
              return (
                <div key={emp.id} style={{ padding: 16, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 600 }}>{emp.name.charAt(0)}</div>
                    <div><p style={{ fontWeight: 600, color: '#1e293b', margin: 0, fontSize: 14 }}>{emp.name}</p><p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{emp.department}</p></div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: isWorking ? (isOnBreak ? '#fffbeb' : '#f0fdf4') : '#f1f5f9', color: isWorking ? (isOnBreak ? '#b45309' : '#16a34a') : '#64748b' }}>{isWorking ? (isOnBreak ? 'Break' : 'Working') : 'Offline'}</span>
                </div>
              );
            })}</div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
