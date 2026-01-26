import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, Clock, Coffee, LogIn, LogOut, AlertTriangle, Users, Settings, Bell, CheckCircle, ChevronRight, Menu, X, User, Shield, Activity, Zap, Eye } from 'lucide-react';

// Work location config - UPDATE THESE TO YOUR OFFICE COORDINATES
const WORK_LOCATION = {
  latitude: 17.4401,
  longitude: 78.3489,
  radius: 100,
  name: "Main Office - Hyderabad"
};

// Spot check settings - CUSTOMIZE THESE AS NEEDED
const SPOT_CHECK_CONFIG = {
  minInterval: 30 * 60 * 1000,     // Min 30 minutes between checks
  maxInterval: 90 * 60 * 1000,     // Max 90 minutes between checks
  responseTimeout: 5 * 60 * 1000,  // 5 minutes to respond
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

const EMPLOYEES = [
  { id: 'EMP001', name: 'Rahul Sharma', department: 'Sales', phone: '+91 98765 43210' },
  { id: 'EMP002', name: 'Priya Patel', department: 'Marketing', phone: '+91 98765 43211' },
  { id: 'EMP003', name: 'Amit Kumar', department: 'Operations', phone: '+91 98765 43212' },
  { id: 'EMP004', name: 'Sneha Reddy', department: 'HR', phone: '+91 98765 43213' },
];

export default function GeoTrack() {
  const [view, setView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    setAlerts(prev => [{ id: Date.now(), type: 'spot-check-missed', message: `${currentUser?.name} missed spot check`, time: new Date(), employeeId: currentUser?.id, severity: 'high' }, ...prev]);
    setSpotCheckLog(prev => [{ id: Date.now(), employeeId: currentUser?.id, employeeName: currentUser?.name, type: 'spot-check-missed', time: new Date(), status: 'missed' }, ...prev]);
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
            setAlerts(prev => [{ id: Date.now(), type: 'location', message: `${currentUser?.name} left work location`, time: new Date(), employeeId: currentUser?.id, severity: 'high' }, ...prev]);
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
    setSpotCheckLog(prev => [{ id: Date.now(), employeeId: currentUser?.id, employeeName: currentUser?.name, type: 'spot-check', time: new Date(), selfie: spotCheckSelfie, location: spotCheckLocation, locationValid: isLocationValid, status: isLocationValid ? 'verified' : 'location-mismatch' }, ...prev]);
    if (!isLocationValid) {
      setAlerts(prev => [{ id: Date.now(), type: 'spot-check-location', message: `${currentUser?.name} spot check outside work area`, time: new Date(), employeeId: currentUser?.id, severity: 'high', selfie: spotCheckSelfie }, ...prev]);
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
    setAttendanceLog(prev => [{ id: Date.now(), employeeId: currentUser.id, employeeName: currentUser.name, type: 'clock-in', time: new Date(), location: { ...location }, selfie: selfieUrl }, ...prev]);
  };

  const handleClockOut = () => {
    if (spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    if (deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    setSpotCheckActive(false);
    setAttendanceLog(prev => [{ id: Date.now(), employeeId: currentUser.id, employeeName: currentUser.name, type: 'clock-out', time: new Date(), location: { ...location }, totalWorkTime: new Date() - clockInTime - totalBreakTime, totalBreakTime, missedSpotChecks }, ...prev]);
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
    setAttendanceLog(prev => [{ id: Date.now(), employeeId: currentUser.id, employeeName: currentUser.name, type: 'break-start', time: new Date(), location: { ...location } }, ...prev]);
  };

  const endBreak = () => {
    const breakDuration = new Date() - breakStartTime;
    setTotalBreakTime(prev => prev + breakDuration);
    setOnBreak(false);
    setBreakStartTime(null);
    setAttendanceLog(prev => [{ id: Date.now(), employeeId: currentUser.id, employeeName: currentUser.name, type: 'break-end', time: new Date(), location: { ...location }, breakDuration }, ...prev]);
  };

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
    * { font-family: 'DM Sans', sans-serif; box-sizing: border-box; }
    .mono { font-family: 'Space Mono', monospace; }
    .glass { background: rgba(255,255,255,0.05); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); }
    @keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(1.4); opacity: 0; } }
    .pulse-ring { animation: pulse-ring 2s infinite; }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
    .shake { animation: shake 0.4s infinite; }
  `;

  // SPOT CHECK MODAL
  if (spotCheckActive && view === 'employee') {
    const timeRemaining = Math.max(0, spotCheckDeadline - currentTime);
    const isUrgent = timeRemaining < 60000;
    return (
      <div className="min-h-screen bg-black/90 flex items-center justify-center p-4">
        <style>{styles}</style>
        <div className={`w-full max-w-md glass rounded-3xl p-6 border-2 ${isUrgent ? 'border-red-500 shake' : 'border-amber-500'}`}>
          <div className="text-center mb-6">
            <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 ${isUrgent ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
              <Eye className={`w-8 h-8 ${isUrgent ? 'text-red-400' : 'text-amber-400'}`} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">🚨 Spot Check!</h2>
            <p className="text-slate-400">Take a LIVE selfie to verify your presence</p>
          </div>
          <div className={`text-center py-4 rounded-xl mb-6 ${isUrgent ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
            <p className="text-slate-400 text-sm mb-1">Time Remaining</p>
            <p className={`text-4xl font-bold mono ${isUrgent ? 'text-red-400' : 'text-amber-400'}`}>{formatDuration(timeRemaining)}</p>
          </div>
          {showCamera ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                <div className="absolute bottom-2 left-2 right-2 bg-black/70 rounded p-2 text-xs text-white mono">
                  {new Date().toLocaleString('en-IN')} | {location?.latitude?.toFixed(5)}, {location?.longitude?.toFixed(5)}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => capturePhoto(true)} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold">📸 Capture</button>
                <button onClick={stopCamera} className="px-4 py-3 rounded-xl bg-slate-700 text-white"><X className="w-5 h-5" /></button>
              </div>
            </div>
          ) : spotCheckSelfie ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                <img src={spotCheckSelfie} alt="Selfie" className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-green-500 text-white text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Ready</div>
              </div>
              <div className={`p-3 rounded-xl flex items-center gap-2 ${isAtWork ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                <MapPin className={`w-5 h-5 ${isAtWork ? 'text-green-400' : 'text-red-400'}`} />
                <span className={`font-medium ${isAtWork ? 'text-green-400' : 'text-red-400'}`}>{isAtWork ? '✓ At Work Location' : '✗ Outside Work Area!'}</span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setSpotCheckSelfie(null); startCamera(); }} className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium">Retake</button>
                <button onClick={submitSpotCheck} className="flex-1 py-3 rounded-xl bg-green-500 text-white font-semibold flex items-center justify-center gap-2"><CheckCircle className="w-5 h-5" /> Submit</button>
              </div>
            </div>
          ) : (
            <button onClick={startCamera} className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center gap-2"><Camera className="w-6 h-6" /> Take Live Selfie</button>
          )}
          <p className="text-center text-red-400 text-sm mt-4 font-medium">⚠️ Missing this check will alert your manager!</p>
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <style>{styles}</style>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-500/20 mb-4 relative">
              <div className="absolute inset-0 rounded-2xl bg-blue-500/20 pulse-ring"></div>
              <MapPin className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">GeoTrack</h1>
            <p className="text-slate-400">Employee Attendance & Location Monitor</p>
          </div>
          <div className="glass rounded-3xl p-6 mb-4">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><User className="w-5 h-5 text-blue-400" /> Employee Login</h2>
            <div className="space-y-3">
              {EMPLOYEES.map(emp => (
                <button key={emp.id} onClick={() => { setCurrentUser(emp); setView('employee'); }} className="w-full p-4 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">{emp.name.charAt(0)}</div>
                    <div className="text-left"><p className="text-white font-medium">{emp.name}</p><p className="text-slate-400 text-sm">{emp.department}</p></div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-white" />
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => { setCurrentUser({ name: 'Administrator', id: 'ADMIN' }); setView('admin'); }} className="w-full glass rounded-2xl p-4 flex items-center justify-center gap-3 text-white hover:bg-white/10"><Shield className="w-5 h-5 text-amber-400" /><span className="font-medium">Admin Dashboard</span></button>
        </div>
      </div>
    );
  }

  // EMPLOYEE VIEW
  if (view === 'employee') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <style>{styles}</style>
        <header className="glass border-b border-white/10 px-4 py-4">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">{currentUser?.name?.charAt(0)}</div>
              <div><p className="text-white font-medium">{currentUser?.name}</p><p className="text-slate-400 text-sm mono">{currentUser?.id}</p></div>
            </div>
            <button onClick={() => { setView('login'); setCurrentUser(null); setSelfieUrl(null); setIsClockedIn(false); }} className="p-2 rounded-lg hover:bg-white/10"><LogOut className="w-5 h-5 text-slate-400" /></button>
          </div>
        </header>
        <main className="max-w-lg mx-auto p-4 space-y-4">
          <div className="text-center py-6">
            <p className="text-5xl font-bold text-white mono">{currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</p>
            <p className="text-slate-400 mt-2">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
          <div className={`glass rounded-2xl p-4 border ${isAtWork ? 'border-green-500/50' : 'border-red-500/50'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isAtWork ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <MapPin className={`w-6 h-6 ${isAtWork ? 'text-green-400' : 'text-red-400'}`} />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Location Status</p>
                <p className={`text-sm ${isAtWork ? 'text-green-400' : 'text-red-400'}`}>{location ? (isAtWork ? '✓ At Work Location' : '✗ Outside Work Area') : locationError || 'Detecting...'}</p>
              </div>
              {location && <div className="text-right"><p className="text-slate-400 text-xs">Accuracy</p><p className="text-white text-sm mono">{Math.round(location.accuracy)}m</p></div>}
            </div>
          </div>
          {!isClockedIn && (
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><Camera className="w-6 h-6 text-purple-400" /></div>
                <div><p className="text-white font-medium">Selfie Verification</p><p className="text-slate-400 text-sm">Required for clock-in</p></div>
              </div>
              {showCamera ? (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => capturePhoto(false)} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-medium">Capture</button>
                    <button onClick={stopCamera} className="px-4 py-3 rounded-xl bg-slate-700 text-white"><X className="w-5 h-5" /></button>
                  </div>
                </div>
              ) : selfieUrl ? (
                <div className="space-y-4">
                  <div className="relative rounded-xl overflow-hidden aspect-[4/3]">
                    <img src={selfieUrl} alt="Selfie" className="w-full h-full object-cover" />
                    <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-green-500 text-white text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Captured</div>
                  </div>
                  <button onClick={() => { setSelfieUrl(null); startCamera(); }} className="w-full py-3 rounded-xl bg-slate-700 text-white font-medium">Retake Photo</button>
                </div>
              ) : (
                <button onClick={startCamera} className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium flex items-center justify-center gap-2"><Camera className="w-5 h-5" /> Open Camera</button>
              )}
            </div>
          )}
          {!isClockedIn ? (
            <button onClick={handleClockIn} disabled={!isAtWork || !selfieUrl} className={`w-full py-5 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all ${isAtWork && selfieUrl ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/30' : 'bg-slate-700 text-slate-400 cursor-not-allowed'}`}><LogIn className="w-6 h-6" /> Clock In</button>
          ) : (
            <div className="space-y-4">
              <div className="glass rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><Clock className="w-6 h-6 text-green-400" /></div>
                    <div><p className="text-slate-400 text-sm">Working Since</p><p className="text-white font-semibold">{formatTime(clockInTime)}</p></div>
                  </div>
                  <div className="text-right"><p className="text-slate-400 text-sm">Duration</p><p className="text-2xl font-bold text-green-400 mono">{formatDuration(currentTime - clockInTime - totalBreakTime)}</p></div>
                </div>
              </div>
              {!onBreak && (
                <div className="glass rounded-2xl p-4 border border-purple-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center"><Eye className="w-5 h-5 text-purple-400" /></div>
                      <div><p className="text-white font-medium">Random Spot Checks</p><p className="text-purple-400 text-sm">Active • Be ready for verification</p></div>
                    </div>
                    <button onClick={triggerSpotCheck} className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-sm hover:bg-purple-500/30 flex items-center gap-1"><Zap className="w-4 h-4" /> Test</button>
                  </div>
                </div>
              )}
              {missedSpotChecks > 0 && (
                <div className="glass rounded-2xl p-4 border border-red-500/50 bg-red-500/10">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-400" />
                    <div><p className="text-red-400 font-medium">Missed Spot Checks: {missedSpotChecks}</p><p className="text-slate-400 text-sm">Reported to admin</p></div>
                  </div>
                </div>
              )}
              {!onBreak ? (
                <button onClick={startBreak} className="w-full py-4 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 font-semibold flex items-center justify-center gap-3 hover:bg-amber-500/30"><Coffee className="w-5 h-5" /> Start Break</button>
              ) : (
                <div className="glass rounded-2xl p-4 border border-amber-500/50 shadow-lg shadow-amber-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3"><Coffee className="w-6 h-6 text-amber-400" /><div><p className="text-amber-400 font-medium">On Break</p><p className="text-slate-400 text-sm">Since {formatTime(breakStartTime)}</p></div></div>
                    <p className="text-2xl font-bold text-amber-400 mono">{formatDuration(currentTime - breakStartTime)}</p>
                  </div>
                  <button onClick={endBreak} className="w-full py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600">End Break</button>
                </div>
              )}
              <button onClick={handleClockOut} className="w-full py-5 rounded-2xl bg-gradient-to-r from-red-500 to-rose-500 text-white font-semibold text-lg flex items-center justify-center gap-3 shadow-lg shadow-red-500/30"><LogOut className="w-6 h-6" /> Clock Out</button>
              <div className="glass rounded-2xl p-4">
                <h3 className="text-white font-semibold mb-3">Today's Summary</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-xl p-3"><p className="text-slate-400 text-xs">Work</p><p className="text-lg font-bold text-white mono">{formatDuration(currentTime - clockInTime - totalBreakTime)}</p></div>
                  <div className="bg-slate-800/50 rounded-xl p-3"><p className="text-slate-400 text-xs">Break</p><p className="text-lg font-bold text-white mono">{formatDuration(totalBreakTime + (onBreak ? currentTime - breakStartTime : 0))}</p></div>
                  <div className="bg-slate-800/50 rounded-xl p-3"><p className="text-slate-400 text-xs">Missed</p><p className={`text-lg font-bold mono ${missedSpotChecks > 0 ? 'text-red-400' : 'text-green-400'}`}>{missedSpotChecks}</p></div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ADMIN DASHBOARD
  if (view === 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <style>{styles}</style>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="fixed top-4 left-4 z-50 lg:hidden p-3 rounded-xl glass">{sidebarOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}</button>
        <aside className={`fixed inset-y-0 left-0 w-64 glass border-r border-white/10 z-40 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8"><div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center"><MapPin className="w-5 h-5 text-blue-400" /></div><div><h1 className="text-xl font-bold text-white">GeoTrack</h1><p className="text-slate-400 text-xs">Admin Panel</p></div></div>
            <nav className="space-y-2">
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/20 text-blue-400"><Activity className="w-5 h-5" /><span>Dashboard</span></button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5"><Users className="w-5 h-5" /><span>Employees</span></button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5"><Eye className="w-5 h-5" /><span>Spot Checks</span></button>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5"><Settings className="w-5 h-5" /><span>Settings</span></button>
            </nav>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-6"><button onClick={() => { setView('login'); setCurrentUser(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-white/5"><LogOut className="w-5 h-5" /><span>Logout</span></button></div>
        </aside>
        <main className="lg:ml-64 p-4 lg:p-8">
          <header className="flex items-center justify-between mb-8 pt-12 lg:pt-0">
            <div><h2 className="text-2xl font-bold text-white">Dashboard</h2><p className="text-slate-400">{currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
            <div className="flex items-center gap-4">
              <button className="relative p-3 rounded-xl glass hover:bg-white/10"><Bell className="w-5 h-5 text-slate-400" />{alerts.length > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">{alerts.length}</span>}</button>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-semibold">A</div>
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="glass rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-blue-400" /></div></div><p className="text-3xl font-bold text-white">{EMPLOYEES.length}</p><p className="text-slate-400">Total Employees</p></div>
            <div className="glass rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><CheckCircle className="w-6 h-6 text-green-400" /></div></div><p className="text-3xl font-bold text-white">{attendanceLog.filter(l => l.type === 'clock-in').length}</p><p className="text-slate-400">Clocked In</p></div>
            <div className="glass rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><Eye className="w-6 h-6 text-purple-400" /></div></div><p className="text-3xl font-bold text-white">{spotCheckLog.filter(l => l.status === 'verified').length}</p><p className="text-slate-400">Spot Checks OK</p></div>
            <div className="glass rounded-2xl p-6"><div className="flex items-center justify-between mb-4"><div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center"><AlertTriangle className="w-6 h-6 text-red-400" /></div></div><p className="text-3xl font-bold text-white">{alerts.length}</p><p className="text-slate-400">Active Alerts</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="glass rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4"><h3 className="text-lg font-semibold text-white flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-400" /> Alerts</h3>{alerts.length > 0 && <button onClick={() => setAlerts([])} className="text-sm text-slate-400 hover:text-white">Clear</button>}</div>
              {alerts.length === 0 ? <div className="text-center py-8"><CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" /><p className="text-slate-400">No alerts</p></div> : (
                <div className="space-y-3 max-h-64 overflow-y-auto">{alerts.map(alert => (
                  <div key={alert.id} className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                    <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-red-400 mt-0.5" /><div className="flex-1"><p className="text-white text-sm">{alert.message}</p><p className="text-slate-400 text-xs">{formatTime(alert.time)}</p></div><button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} className="p-1 hover:bg-white/10 rounded"><X className="w-3 h-3 text-slate-400" /></button></div>
                    {alert.selfie && <img src={alert.selfie} alt="Alert" className="w-full h-16 object-cover rounded mt-2" />}
                  </div>
                ))}</div>
              )}
            </div>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Eye className="w-5 h-5 text-purple-400" /> Spot Check Log</h3>
              {spotCheckLog.length === 0 ? <div className="text-center py-8"><Eye className="w-12 h-12 text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No spot checks yet</p></div> : (
                <div className="space-y-3 max-h-64 overflow-y-auto">{spotCheckLog.slice(0, 10).map(log => (
                  <div key={log.id} className={`p-3 rounded-xl border ${log.status === 'verified' ? 'bg-green-500/10 border-green-500/30' : log.status === 'missed' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex items-center gap-3">{log.selfie && <img src={log.selfie} alt="Check" className="w-10 h-10 rounded object-cover" />}<div className="flex-1"><p className="text-white text-sm">{log.employeeName}</p><p className={`text-xs ${log.status === 'verified' ? 'text-green-400' : log.status === 'missed' ? 'text-red-400' : 'text-amber-400'}`}>{log.status === 'verified' ? '✓ Verified' : log.status === 'missed' ? '✗ Missed' : '⚠ Wrong Location'}</p></div><p className="text-slate-500 text-xs mono">{formatTime(log.time)}</p></div>
                  </div>
                ))}</div>
              )}
            </div>
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" /> Activity Log</h3>
              {attendanceLog.length === 0 ? <div className="text-center py-8"><Clock className="w-12 h-12 text-slate-500 mx-auto mb-2" /><p className="text-slate-400">No activity</p></div> : (
                <div className="space-y-3 max-h-64 overflow-y-auto">{attendanceLog.slice(0, 10).map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-800/50">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.type === 'clock-in' ? 'bg-green-500/20' : log.type === 'clock-out' ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
                      {log.type === 'clock-in' && <LogIn className="w-4 h-4 text-green-400" />}
                      {log.type === 'clock-out' && <LogOut className="w-4 h-4 text-red-400" />}
                      {(log.type === 'break-start' || log.type === 'break-end') && <Coffee className="w-4 h-4 text-amber-400" />}
                    </div>
                    <div className="flex-1"><p className="text-white text-sm">{log.employeeName}</p><p className="text-slate-400 text-xs">{log.type.replace('-', ' ')}</p></div>
                    <p className="text-slate-500 text-xs mono">{formatTime(log.time)}</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
          <div className="glass rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">All Employees</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">{EMPLOYEES.map(emp => {
              const lastLog = attendanceLog.find(l => l.employeeId === emp.id);
              const isWorking = lastLog && ['clock-in', 'break-start', 'break-end'].includes(lastLog.type);
              const isOnBreak = lastLog?.type === 'break-start';
              const missed = spotCheckLog.filter(l => l.employeeId === emp.id && l.status === 'missed').length;
              return (
                <div key={emp.id} className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold text-lg">{emp.name.charAt(0)}</div><div><p className="text-white font-medium">{emp.name}</p><p className="text-slate-400 text-sm">{emp.department}</p></div></div>
                  <div className="flex items-center justify-between"><span className={`px-3 py-1 rounded-full text-xs font-medium ${isWorking ? (isOnBreak ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400') : 'bg-slate-700 text-slate-400'}`}>{isWorking ? (isOnBreak ? 'Break' : 'Working') : 'Offline'}</span>{missed > 0 && <span className="px-2 py-1 rounded-full text-xs bg-red-500/20 text-red-400">{missed} missed</span>}</div>
                  {lastLog?.selfie && <img src={lastLog.selfie} alt="Selfie" className="w-full h-20 object-cover rounded-lg mt-3" />}
                </div>
              );
            })}</div>
          </div>
          <div className="glass rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2"><Settings className="w-5 h-5 text-slate-400" /> Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-400 text-sm mb-1">Work Location</p><p className="text-white font-medium">{WORK_LOCATION.name}</p></div>
              <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-400 text-sm mb-1">Geofence</p><p className="text-white font-medium">{WORK_LOCATION.radius}m radius</p></div>
              <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-400 text-sm mb-1">Spot Check Interval</p><p className="text-white font-medium">{SPOT_CHECK_CONFIG.minInterval/60000}-{SPOT_CHECK_CONFIG.maxInterval/60000} min</p></div>
              <div className="bg-slate-800/50 rounded-xl p-4"><p className="text-slate-400 text-sm mb-1">Response Timeout</p><p className="text-white font-medium">{SPOT_CHECK_CONFIG.responseTimeout/60000} min</p></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return null;
}
