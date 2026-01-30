import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, MapPin, Clock, Coffee, LogIn, LogOut, AlertTriangle, Users, Bell, CheckCircle, X, User, Shield, Activity, Zap, Eye, Lock, Key, Download, FileSpreadsheet, Wifi, WifiOff } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, orderBy, limit, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDcskLSdYbOLdG77vJUhYfRWo-t-LnPews",
  authDomain: "geotrack-485e5.firebaseapp.com",
  projectId: "geotrack-485e5",
  storageBucket: "geotrack-485e5.firebasestorage.app",
  messagingSenderId: "1075254024451",
  appId: "1:1075254024451:web:c66fbc7b88e90b1867b136",
  measurementId: "G-97KTE62GNB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const WORK_LOCATION = { latitude: 17.8600393, longitude: 76.9492326, radius: 100, name: "Office Location" };
const SPOT_CHECK_CONFIG = { minInterval: 30*60*1000, maxInterval: 90*60*1000, responseTimeout: 5*60*1000, enabled: true };

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3, φ1 = lat1*Math.PI/180, φ2 = lat2*Math.PI/180, Δφ = (lat2-lat1)*Math.PI/180, Δλ = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const formatTime = (date) => { if(!date) return ''; const d = date?.toDate ? date.toDate() : new Date(date); return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); };
const formatDate = (date) => { if(!date) return ''; const d = date?.toDate ? date.toDate() : new Date(date); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const formatDuration = (ms) => { if(!ms||ms<=0) return '0m'; const h=Math.floor(ms/(1000*60*60)), m=Math.floor((ms%(1000*60*60))/(1000*60)), s=Math.floor((ms%(1000*60))/1000); if(h>0) return `${h}h ${m}m`; if(m>0) return `${m}m ${s}s`; return `${s}s`; };
const formatDurationForExcel = (ms) => { if(!ms||ms<=0) return '0h 0m'; const h=Math.floor(ms/(1000*60*60)), m=Math.floor((ms%(1000*60*60))/(1000*60)); return `${h}h ${m}m`; };
const getRandomInterval = () => Math.floor(Math.random()*(SPOT_CHECK_CONFIG.maxInterval-SPOT_CHECK_CONFIG.minInterval))+SPOT_CHECK_CONFIG.minInterval;

const INITIAL_EMPLOYEES = [
  { id: 'EMP001', username: 'kallu', name: 'Kallu', department: 'Sales', phone: '+91 98765 43210', password: '12345' },
  { id: 'EMP002', username: 'karthu', name: 'Karthu', department: 'Marketing', phone: '+91 98765 43211', password: '12345' },
  { id: 'EMP003', username: 'rahul', name: 'Rahul', department: 'Operations', phone: '+91 98765 43212', password: '12345' },
  { id: 'EMP004', username: 'priya', name: 'Priya', department: 'HR', phone: '+91 98765 43213', password: '12345' },
  { id: 'EMP005', username: 'amit', name: 'Amit', department: 'Finance', phone: '+91 98765 43214', password: '12345' },
];
const INITIAL_ADMIN = { id: 'ADMIN', username: 'admin', name: 'Administrator', password: '12345' };

export default function GeoTrack() {
  const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
  const [adminCredentials, setAdminCredentials] = useState(INITIAL_ADMIN);
  const [isOnline, setIsOnline] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [view, setView] = useState('login');
  const [loginType, setLoginType] = useState('employee');
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
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

  useEffect(() => {
    const init = async () => {
      try {
        const snap = await getDocs(collection(db, 'employees'));
        if (snap.empty) {
          for (const emp of INITIAL_EMPLOYEES) await setDoc(doc(db, 'employees', emp.id), emp);
          await setDoc(doc(db, 'admin', 'credentials'), INITIAL_ADMIN);
        } else {
          const emps = []; snap.forEach(d => emps.push(d.data())); setEmployees(emps);
          const adminDoc = await getDoc(doc(db, 'admin', 'credentials'));
          if (adminDoc.exists()) setAdminCredentials(adminDoc.data());
        }
        setIsOnline(true);
      } catch (e) { console.error(e); setIsOnline(false); }
      setDataLoaded(true);
    };
    init();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, s => { const l=[]; s.forEach(d => l.push({id:d.id,...d.data()})); setAttendanceLog(l); }, e => console.error(e));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, s => { const l=[]; s.forEach(d => l.push({id:d.id,...d.data()})); setAlerts(l); }, e => console.error(e));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'spotchecks'), orderBy('timestamp', 'desc'), limit(100));
    return onSnapshot(q, s => { const l=[]; s.forEach(d => l.push({id:d.id,...d.data()})); setSpotCheckLog(l); }, e => console.error(e));
  }, []);

  useEffect(() => {
    return onSnapshot(collection(db, 'employees'), s => { const e=[]; s.forEach(d => e.push(d.data())); if(e.length>0) setEmployees(e); }, e => console.error(e));
  }, []);

  useEffect(() => { const t = setInterval(() => setCurrentTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const saveAttendance = async (data) => { try { await addDoc(collection(db, 'attendance'), {...data, timestamp: serverTimestamp()}); } catch(e) { console.error(e); } };
  const saveAlert = async (data) => { try { await addDoc(collection(db, 'alerts'), {...data, timestamp: serverTimestamp()}); } catch(e) { console.error(e); } };
  const saveSpotCheck = async (data) => { try { await addDoc(collection(db, 'spotchecks'), {...data, timestamp: serverTimestamp()}); } catch(e) { console.error(e); } };
  const updateEmployeeStatus = async (id, status) => { try { await updateDoc(doc(db, 'employees', id), {status, lastUpdate: serverTimestamp()}); } catch(e) { console.error(e); } };

  const triggerSpotCheck = useCallback(() => {
    setSpotCheckActive(true); setSpotCheckDeadline(Date.now()+SPOT_CHECK_CONFIG.responseTimeout); setSpotCheckSelfie(null); setSpotCheckLocation(null);
    try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Onp+Zk4yCfHZ4foSLj46LhoF9e3+FjJGTkY2Ifnt5fICGi46NiYR+eXd4fICEh4eGg398eXl7foKFh4eGhIF+fHt8f4KFh4eHhYOAfn19f4KEhoaGhYOBf35+f4GDhYaGhYSCgH9+fn+BgYOEhISEg4KBgH9/f4CBgoODg4OCgYGAgICAgIGBgoKCgoGBgYGAgICAgYGBgYGBgYGBgYGAgA==').play().catch(()=>{}); } catch(e){}
  }, []);

  const handleMissedSpotCheck = useCallback(() => {
    setMissedSpotChecks(p => p+1); setSpotCheckActive(false);
    saveAlert({ type: 'spot-check-missed', message: `${currentUser?.name} missed spot check`, time: new Date().toISOString(), visibleTo: currentUser?.id, severity: 'high' });
    saveSpotCheck({ visibleTo: currentUser?.id, visibleToName: currentUser?.name, type: 'spot-check-missed', time: new Date().toISOString(), status: 'missed' });
  }, [currentUser]);

  const scheduleNextSpotCheck = useCallback(() => {
    if(spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    spotCheckTimerRef.current = setTimeout(() => { if(isClockedIn && !onBreak) triggerSpotCheck(); }, getRandomInterval());
  }, [isClockedIn, onBreak, triggerSpotCheck]);

  useEffect(() => {
    if(spotCheckActive) { deadlineTimerRef.current = setTimeout(() => { if(spotCheckActive && !spotCheckSelfie) handleMissedSpotCheck(); scheduleNextSpotCheck(); }, SPOT_CHECK_CONFIG.responseTimeout); }
    return () => { if(deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current); };
  }, [spotCheckActive, spotCheckSelfie, handleMissedSpotCheck, scheduleNextSpotCheck]);

  useEffect(() => {
    if(isClockedIn && !onBreak && SPOT_CHECK_CONFIG.enabled) scheduleNextSpotCheck();
    else if(spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    return () => { if(spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current); };
  }, [isClockedIn, onBreak, scheduleNextSpotCheck]);

  useEffect(() => {
    if(view === 'employee' && navigator.geolocation) {
      const id = navigator.geolocation.watchPosition(
        p => { const {latitude,longitude,accuracy} = p.coords; setLocation({latitude,longitude,accuracy}); setLocationError(null);
          const d = calculateDistance(latitude,longitude,WORK_LOCATION.latitude,WORK_LOCATION.longitude);
          const was = isAtWork, now = d <= WORK_LOCATION.radius; setIsAtWork(now);
          if(was && !now && isClockedIn && !onBreak) saveAlert({ type:'location', message:`${currentUser?.name} left work location`, time:new Date().toISOString(), visibleTo:currentUser?.id, severity:'high' });
        },
        e => setLocationError(e.message), { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(id);
    }
  }, [view, isClockedIn, onBreak, isAtWork, currentUser]);

  const startCamera = async () => { try { const s = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}}); streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; setShowCamera(true); } catch(e) { alert('Camera access denied.'); } };
  const stopCamera = () => { if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); setShowCamera(false); };
  
  const capturePhoto = (isSpot=false) => {
    if(videoRef.current) {
      const c = document.createElement('canvas'); c.width=videoRef.current.videoWidth; c.height=videoRef.current.videoHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(videoRef.current,0,0);
      ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.fillRect(0,c.height-50,c.width,50);
      ctx.fillStyle='white'; ctx.font='14px monospace';
      ctx.fillText(`${new Date().toLocaleString('en-IN')} | Lat: ${location?.latitude?.toFixed(5)} Lng: ${location?.longitude?.toFixed(5)}`, 10, c.height-18);
      const url = c.toDataURL('image/jpeg', 0.5);
      if(isSpot) { setSpotCheckSelfie(url); setSpotCheckLocation({...location}); } else setSelfieUrl(url);
      stopCamera();
    }
  };

  const submitSpotCheck = () => {
    if(!spotCheckSelfie) { alert('Please take a selfie first!'); return; }
    if(deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    const valid = spotCheckLocation && calculateDistance(spotCheckLocation.latitude,spotCheckLocation.longitude,WORK_LOCATION.latitude,WORK_LOCATION.longitude) <= WORK_LOCATION.radius;
    saveSpotCheck({ visibleTo:currentUser?.id, visibleToName:currentUser?.name, type:'spot-check', time:new Date().toISOString(), selfie:spotCheckSelfie, location:spotCheckLocation, locationValid:valid, status:valid?'verified':'location-mismatch' });
    if(!valid) saveAlert({ type:'spot-check-location', message:`${currentUser?.name} spot check outside work area`, time:new Date().toISOString(), visibleTo:currentUser?.id, severity:'high' });
    setSpotCheckActive(false); setSpotCheckSelfie(null); scheduleNextSpotCheck();
  };

  const handleClockIn = async () => {
    if(!location) { alert('Enable location services.'); return; }
    if(!isAtWork) { alert('Must be at work location.'); return; }
    if(!selfieUrl) { alert('Take a selfie first.'); return; }
    const now = new Date(); setIsClockedIn(true); setClockInTime(now); setMissedSpotChecks(0);
    await saveAttendance({ visibleTo:currentUser.id, visibleToName:currentUser.name, department:currentUser.department, type:'clock-in', time:now.toISOString(), location:{...location}, selfie:selfieUrl });
    await updateEmployeeStatus(currentUser.id, 'working');
  };

  const handleClockOut = async () => {
    if(spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    if(deadlineTimerRef.current) clearTimeout(deadlineTimerRef.current);
    setSpotCheckActive(false);
    const now = new Date();
    await saveAttendance({ visibleTo:currentUser.id, visibleToName:currentUser.name, department:currentUser.department, type:'clock-out', time:now.toISOString(), location:{...location}, totalWorkTime:now-clockInTime-totalBreakTime, totalBreakTime, missedSpotChecks });
    await updateEmployeeStatus(currentUser.id, 'offline');
    setIsClockedIn(false); setClockInTime(null); setTotalBreakTime(0); setSelfieUrl(null); setMissedSpotChecks(0);
  };

  const startBreak = async () => {
    setOnBreak(true); setBreakStartTime(new Date()); if(spotCheckTimerRef.current) clearTimeout(spotCheckTimerRef.current);
    await saveAttendance({ visibleTo:currentUser.id, visibleToName:currentUser.name, department:currentUser.department, type:'break-start', time:new Date().toISOString(), location:{...location} });
    await updateEmployeeStatus(currentUser.id, 'break');
  };

  const endBreak = async () => {
    const dur = new Date() - breakStartTime; setTotalBreakTime(p => p+dur); setOnBreak(false); setBreakStartTime(null);
    await saveAttendance({ visibleTo:currentUser.id, visibleToName:currentUser.name, department:currentUser.department, type:'break-end', time:new Date().toISOString(), location:{...location}, breakDuration:dur });
    await updateEmployeeStatus(currentUser.id, 'working');
  };

  const exportToExcel = (type) => {
    let csv = '', fn = ''; const today = new Date().toLocaleDateString('en-IN').replace(/\//g,'-');
    if(type==='attendance') { fn=`GeoTrack_Attendance_${today}.csv`; csv='Employee ID,Name,Department,Action,Date,Time,Lat,Lng,Work Duration,Break Duration,Missed\n';
      attendanceLog.forEach(l => { csv += `${l.visibleTo},${l.visibleToName},${l.department||'N/A'},${l.type},${formatDate(l.time||l.timestamp)},${formatTime(l.time||l.timestamp)},${l.location?.latitude?.toFixed(6)||'N/A'},${l.location?.longitude?.toFixed(6)||'N/A'},${l.totalWorkTime?formatDurationForExcel(l.totalWorkTime):'N/A'},${l.totalBreakTime?formatDurationForExcel(l.totalBreakTime):'N/A'},${l.missedSpotChecks!==undefined?l.missedSpotChecks:'N/A'}\n`; });
    } else if(type==='spotchecks') { fn=`GeoTrack_SpotChecks_${today}.csv`; csv='Employee ID,Name,Date,Time,Status,Location Valid,Lat,Lng\n';
      spotCheckLog.forEach(l => { csv += `${l.visibleTo},${l.visibleToName},${formatDate(l.time||l.timestamp)},${formatTime(l.time||l.timestamp)},${l.status},${l.locationValid?'Yes':'No'},${l.location?.latitude?.toFixed(6)||'N/A'},${l.location?.longitude?.toFixed(6)||'N/A'}\n`; });
    } else if(type==='alerts') { fn=`GeoTrack_Alerts_${today}.csv`; csv='Type,Message,Date,Time,Severity\n';
      alerts.forEach(a => { csv += `${a.type},${a.message},${formatDate(a.time||a.timestamp)},${formatTime(a.time||a.timestamp)},${a.severity||'Normal'}\n`; });
    } else if(type==='employees') { fn=`GeoTrack_Employees_${today}.csv`; csv='ID,Name,Username,Department,Phone,Status\n';
      employees.forEach(e => { csv += `${e.id},${e.name},${e.username},${e.department},${e.phone},${e.status||'Offline'}\n`; });
    } else if(type==='summary') { fn=`GeoTrack_Summary_${today}.csv`; csv='ID,Name,Department,Clock-Ins,Work Time,Break Time,Missed,Alerts\n';
      employees.forEach(e => { const logs=attendanceLog.filter(l=>l.visibleTo===e.id), ci=logs.filter(l=>l.type==='clock-in').length, co=logs.filter(l=>l.type==='clock-out'), tw=co.reduce((s,l)=>s+(l.totalWorkTime||0),0), tb=co.reduce((s,l)=>s+(l.totalBreakTime||0),0), tm=co.reduce((s,l)=>s+(l.missedSpotChecks||0),0), al=alerts.filter(a=>a.visibleTo===e.id).length; csv += `${e.id},${e.name},${e.department},${ci},${formatDurationForExcel(tw)},${formatDurationForExcel(tb)},${tm},${al}\n`; });
    }
    const b = new Blob([csv], {type:'text/csv;charset=utf-8;'}), l = document.createElement('a'); l.href = URL.createObjectURL(b); l.download = fn; l.click(); setShowExportModal(false);
  };

  const handleLogin = async () => {
    const u = usernameInput.trim().toLowerCase(), p = passwordInput;
    if(!u) { setLoginError('Please enter username'); return; }
    if(!p) { setLoginError('Please enter password'); return; }
    if(loginType==='admin') {
      try { const d = await getDoc(doc(db,'admin','credentials')); const a = d.exists()?d.data():adminCredentials;
        if(u===a.username.toLowerCase() && p===a.password) { setCurrentUser(a); setView('admin'); setUsernameInput(''); setPasswordInput(''); setLoginError(''); } else setLoginError('Invalid username or password');
      } catch(e) { if(u===adminCredentials.username.toLowerCase() && p===adminCredentials.password) { setCurrentUser(adminCredentials); setView('admin'); setUsernameInput(''); setPasswordInput(''); setLoginError(''); } else setLoginError('Invalid username or password'); }
    } else {
      const emp = employees.find(e => e.username.toLowerCase()===u);
      if(emp && emp.password===p) { setCurrentUser(emp); setView('employee'); setUsernameInput(''); setPasswordInput(''); setLoginError(''); } else setLoginError('Invalid username or password');
    }
  };

  const handleChangePassword = async () => {
    setPasswordChangeError(''); setPasswordChangeSuccess('');
    if(!currentPassword) { setPasswordChangeError('Please enter current password'); return; }
    const correct = view==='admin' ? adminCredentials.password : currentUser.password;
    if(currentPassword!==correct) { setPasswordChangeError('Current password is incorrect'); return; }
    if(!newPassword||!confirmPassword) { setPasswordChangeError('Please fill all fields'); return; }
    if(newPassword.length<4) { setPasswordChangeError('Password must be at least 4 characters'); return; }
    if(newPassword!==confirmPassword) { setPasswordChangeError('New passwords do not match'); return; }
    try {
      if(view==='admin') { await updateDoc(doc(db,'admin','credentials'),{password:newPassword}); setAdminCredentials(p=>({...p,password:newPassword})); }
      else { await updateDoc(doc(db,'employees',currentUser.id),{password:newPassword}); setEmployees(p=>p.map(e=>e.id===currentUser.id?{...e,password:newPassword}:e)); setCurrentUser(p=>({...p,password:newPassword})); }
      setPasswordChangeSuccess('Password changed!'); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setShowChangePassword(false); setPasswordChangeSuccess(''); }, 2000);
    } catch(e) { setPasswordChangeError('Failed to update password'); }
  };

  const handleLogout = () => { setView('login'); setCurrentUser(null); setSelfieUrl(null); setIsClockedIn(false); setShowChangePassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setUsernameInput(''); setPasswordInput(''); };

  const styles = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); * { font-family: 'Inter', -apple-system, sans-serif; box-sizing: border-box; margin: 0; padding: 0; } body { background: #f5f7fa; } input { font-family: 'Inter', sans-serif; }`;

  if(!dataLoaded) return <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea,#764ba2)',display:'flex',alignItems:'center',justifyContent:'center'}}><style>{styles}</style><div style={{textAlign:'center',color:'#fff'}}><div style={{width:60,height:60,border:'4px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 1s linear infinite',margin:'0 auto 20px'}}/><p style={{fontSize:18}}>Loading GeoTrack...</p><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div></div>;

  if(showExportModal) return <div style={{minHeight:'100vh',background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',padding:16,position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:1000}}><style>{styles}</style><div style={{width:'100%',maxWidth:400,background:'#fff',borderRadius:24,padding:24}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:48,height:48,borderRadius:12,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center'}}><FileSpreadsheet style={{width:24,height:24,color:'#22c55e'}}/></div><div><h2 style={{fontSize:20,fontWeight:700,color:'#111',margin:0}}>Export Reports</h2><p style={{color:'#666',fontSize:14,margin:0}}>Download as CSV</p></div></div><button onClick={()=>setShowExportModal(false)} style={{padding:8,borderRadius:8,border:'none',background:'#f1f5f9',cursor:'pointer'}}><X style={{width:20,height:20,color:'#64748b'}}/></button></div><div style={{display:'flex',flexDirection:'column',gap:12}}>{[{t:'attendance',i:<Clock/>,c:'#3b82f6',b:'#eff6ff',n:'Attendance Log',d:'Clock-ins, breaks'},{t:'spotchecks',i:<Eye/>,c:'#8b5cf6',b:'#f5f3ff',n:'Spot Checks',d:'All checks'},{t:'alerts',i:<AlertTriangle/>,c:'#ef4444',b:'#fef2f2',n:'Alerts',d:'All alerts'},{t:'employees',i:<Users/>,c:'#f59e0b',b:'#fffbeb',n:'Employees',d:'All employees'},{t:'summary',i:<FileSpreadsheet/>,c:'#fff',b:'linear-gradient(135deg,#22c55e,#16a34a)',n:'Daily Summary',d:'Complete summary',w:true}].map(x=><button key={x.t} onClick={()=>exportToExcel(x.t)} style={{width:'100%',padding:16,borderRadius:12,border:x.w?'none':'1px solid #e2e8f0',background:x.w?x.b:'#fff',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}><div style={{width:40,height:40,borderRadius:10,background:x.w?'rgba(255,255,255,0.2)':x.b,display:'flex',alignItems:'center',justifyContent:'center'}}>{React.cloneElement(x.i,{style:{width:20,height:20,color:x.c}})}</div><div style={{textAlign:'left',flex:1}}><p style={{fontWeight:600,color:x.w?'#fff':'#1e293b',margin:0}}>{x.n}</p><p style={{color:x.w?'rgba(255,255,255,0.8)':'#64748b',fontSize:13,margin:0}}>{x.d}</p></div><Download style={{width:20,height:20,color:x.w?'#fff':'#94a3b8'}}/></button>)}</div></div></div>;

  if(spotCheckActive && view==='employee') { const rem=Math.max(0,spotCheckDeadline-currentTime), urg=rem<60000; return <div style={{minHeight:'100vh',background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}><style>{styles}</style><div style={{width:'100%',maxWidth:400,background:'#fff',borderRadius:24,padding:24}}><div style={{textAlign:'center',marginBottom:24}}><div style={{width:64,height:64,borderRadius:16,background:urg?'#fee2e2':'#fef3c7',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Eye style={{width:32,height:32,color:urg?'#dc2626':'#f59e0b'}}/></div><h2 style={{fontSize:24,fontWeight:700,color:'#111',marginBottom:8}}>🚨 Spot Check!</h2><p style={{color:'#666',fontSize:14}}>Take a selfie now</p></div><div style={{textAlign:'center',padding:20,borderRadius:16,background:urg?'#fef2f2':'#fffbeb',marginBottom:24}}><p style={{color:'#666',fontSize:12,marginBottom:4}}>Time Remaining</p><p style={{fontSize:36,fontWeight:700,color:urg?'#dc2626':'#f59e0b',fontFamily:'monospace'}}>{formatDuration(rem)}</p></div>{showCamera?<div><div style={{borderRadius:16,overflow:'hidden',background:'#000',marginBottom:16}}><video ref={videoRef} autoPlay playsInline style={{width:'100%',display:'block',transform:'scaleX(-1)'}}/></div><div style={{display:'flex',gap:12}}><button onClick={()=>capturePhoto(true)} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'#22c55e',color:'#fff',fontWeight:600,cursor:'pointer'}}>📸 Capture</button><button onClick={stopCamera} style={{padding:14,borderRadius:12,border:'none',background:'#f1f5f9',cursor:'pointer'}}><X style={{width:20,height:20,color:'#64748b'}}/></button></div></div>:spotCheckSelfie?<div><div style={{position:'relative',borderRadius:16,overflow:'hidden',marginBottom:16}}><img src={spotCheckSelfie} alt="" style={{width:'100%',display:'block'}}/><div style={{position:'absolute',top:12,right:12,padding:'6px 12px',borderRadius:20,background:'#22c55e',color:'#fff',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:4}}><CheckCircle style={{width:14,height:14}}/>Ready</div></div><div style={{padding:12,borderRadius:12,marginBottom:16,display:'flex',alignItems:'center',gap:8,background:isAtWork?'#f0fdf4':'#fef2f2',border:`1px solid ${isAtWork?'#bbf7d0':'#fecaca'}`}}><MapPin style={{width:20,height:20,color:isAtWork?'#22c55e':'#ef4444'}}/><span style={{fontWeight:600,color:isAtWork?'#22c55e':'#ef4444'}}>{isAtWork?'✓ At Work':'✗ Outside!'}</span></div><div style={{display:'flex',gap:12}}><button onClick={()=>{setSpotCheckSelfie(null);startCamera();}} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'#f1f5f9',color:'#475569',fontWeight:600,cursor:'pointer'}}>Retake</button><button onClick={submitSpotCheck} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'#22c55e',color:'#fff',fontWeight:600,cursor:'pointer'}}>Submit</button></div></div>:<button onClick={startCamera} style={{width:'100%',padding:16,borderRadius:12,border:'none',background:'linear-gradient(135deg,#f59e0b,#ea580c)',color:'#fff',fontWeight:700,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Camera style={{width:20,height:20}}/>Take Selfie</button>}<p style={{textAlign:'center',color:'#ef4444',fontSize:13,marginTop:20,fontWeight:500}}>⚠️ Missing = Alert to manager!</p></div></div>; }

  if(showChangePassword) return <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea,#764ba2)',padding:20,display:'flex',alignItems:'center',justifyContent:'center'}}><style>{styles}</style><div style={{width:'100%',maxWidth:400,background:'#fff',borderRadius:24,padding:24}}><div style={{textAlign:'center',marginBottom:24}}><div style={{width:64,height:64,borderRadius:16,background:'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><Key style={{width:32,height:32,color:'#8b5cf6'}}/></div><h2 style={{fontSize:24,fontWeight:700,color:'#111',marginBottom:8}}>Change Password</h2></div>{['Current Password','New Password','Confirm Password'].map((l,i)=><div key={i} style={{marginBottom:16}}><label style={{display:'block',marginBottom:8,fontWeight:500,color:'#374151',fontSize:14}}>{l}</label><input type="password" value={i===0?currentPassword:i===1?newPassword:confirmPassword} onChange={e=>{const v=e.target.value;if(i===0)setCurrentPassword(v);else if(i===1)setNewPassword(v);else setConfirmPassword(v);}} placeholder={l} style={{width:'100%',padding:14,borderRadius:12,border:'1px solid #e2e8f0',fontSize:16,outline:'none'}}/></div>)}{passwordChangeError&&<div style={{padding:12,borderRadius:12,background:'#fef2f2',marginBottom:16}}><p style={{color:'#dc2626',fontSize:14,margin:0}}>{passwordChangeError}</p></div>}{passwordChangeSuccess&&<div style={{padding:12,borderRadius:12,background:'#f0fdf4',marginBottom:16}}><p style={{color:'#22c55e',fontSize:14,margin:0}}>{passwordChangeSuccess}</p></div>}<div style={{display:'flex',gap:12}}><button onClick={()=>{setShowChangePassword(false);setCurrentPassword('');setNewPassword('');setConfirmPassword('');setPasswordChangeError('');}} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'#f1f5f9',color:'#475569',fontWeight:600,cursor:'pointer'}}>Cancel</button><button onClick={handleChangePassword} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontWeight:600,cursor:'pointer'}}>Save</button></div></div></div>;

  if(view==='login') return <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#667eea,#764ba2)',padding:20,display:'flex',alignItems:'center',justifyContent:'center'}}><style>{styles}</style><div style={{width:'100%',maxWidth:400}}><div style={{textAlign:'center',marginBottom:32}}><div style={{width:80,height:80,borderRadius:20,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px'}}><MapPin style={{width:40,height:40,color:'#fff'}}/></div><h1 style={{fontSize:36,fontWeight:700,color:'#fff',marginBottom:8}}>GeoTrack</h1><p style={{color:'rgba(255,255,255,0.8)',fontSize:16}}>Employee Attendance Monitor</p><div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:12}}>{isOnline?<Wifi style={{width:16,height:16,color:'#4ade80'}}/>:<WifiOff style={{width:16,height:16,color:'#f87171'}}/>}<span style={{color:isOnline?'#4ade80':'#f87171',fontSize:14}}>{isOnline?'Connected':'Offline'}</span></div></div><div style={{background:'#fff',borderRadius:24,padding:24}}><div style={{display:'flex',marginBottom:24,background:'#f1f5f9',borderRadius:12,padding:4}}>{[{t:'employee',l:'Employee',i:<User/>,c:'#6366f1'},{t:'admin',l:'Admin',i:<Shield/>,c:'#f59e0b'}].map(x=><button key={x.t} onClick={()=>{setLoginType(x.t);setLoginError('');}} style={{flex:1,padding:12,borderRadius:10,border:'none',background:loginType===x.t?'#fff':'transparent',color:loginType===x.t?x.c:'#64748b',fontWeight:600,cursor:'pointer',boxShadow:loginType===x.t?'0 2px 8px rgba(0,0,0,0.1)':'none',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>{React.cloneElement(x.i,{style:{width:18,height:18}})}{x.l}</button>)}</div><div style={{marginBottom:16}}><label style={{display:'block',marginBottom:8,fontWeight:500,color:'#374151',fontSize:14}}>Username</label><div style={{position:'relative'}}><User style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',width:20,height:20,color:'#94a3b8'}}/><input type="text" value={usernameInput} onChange={e=>{setUsernameInput(e.target.value);setLoginError('');}} onKeyPress={e=>e.key==='Enter'&&handleLogin()} placeholder="Enter username" autoCapitalize="none" style={{width:'100%',padding:'14px 14px 14px 48px',borderRadius:12,border:`1px solid ${loginError?'#fecaca':'#e2e8f0'}`,fontSize:16,outline:'none'}}/></div></div><div style={{marginBottom:20}}><label style={{display:'block',marginBottom:8,fontWeight:500,color:'#374151',fontSize:14}}>Password</label><div style={{position:'relative'}}><Lock style={{position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',width:20,height:20,color:'#94a3b8'}}/><input type={showPassword?'text':'password'} value={passwordInput} onChange={e=>{setPasswordInput(e.target.value);setLoginError('');}} onKeyPress={e=>e.key==='Enter'&&handleLogin()} placeholder="Enter password" style={{width:'100%',padding:'14px 48px 14px 48px',borderRadius:12,border:`1px solid ${loginError?'#fecaca':'#e2e8f0'}`,fontSize:16,outline:'none'}}/><button onClick={()=>setShowPassword(!showPassword)} style={{position:'absolute',right:14,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer'}}><Eye style={{width:20,height:20,color:showPassword?'#6366f1':'#94a3b8'}}/></button></div></div>{loginError&&<div style={{padding:12,borderRadius:12,background:'#fef2f2',marginBottom:16}}><p style={{color:'#dc2626',fontSize:14,margin:0,display:'flex',alignItems:'center',gap:8}}><AlertTriangle style={{width:16,height:16}}/>{loginError}</p></div>}<button onClick={handleLogin} style={{width:'100%',padding:16,borderRadius:12,border:'none',background:loginType==='admin'?'linear-gradient(135deg,#f59e0b,#ea580c)':'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'#fff',fontWeight:600,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><LogIn style={{width:20,height:20}}/>Login</button></div></div></div>;

  if(view==='employee') return <div style={{minHeight:'100vh',background:'#f5f7fa'}}><style>{styles}</style><header style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'16px 20px',position:'sticky',top:0,zIndex:10}}><div style={{maxWidth:500,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600}}>{currentUser?.name?.charAt(0)}</div><div><p style={{fontWeight:600,color:'#1e293b',margin:0}}>{currentUser?.name}</p><p style={{color:'#64748b',fontSize:13,margin:0}}>{currentUser?.department}</p></div></div><div style={{display:'flex',gap:8}}><div style={{padding:10,borderRadius:10,background:isOnline?'#f0fdf4':'#fef2f2'}}>{isOnline?<Wifi style={{width:20,height:20,color:'#22c55e'}}/>:<WifiOff style={{width:20,height:20,color:'#ef4444'}}/>}</div><button onClick={()=>setShowChangePassword(true)} style={{padding:10,borderRadius:10,border:'none',background:'#f1f5f9',cursor:'pointer'}}><Key style={{width:20,height:20,color:'#64748b'}}/></button><button onClick={handleLogout} style={{padding:10,borderRadius:10,border:'none',background:'#f1f5f9',cursor:'pointer'}}><LogOut style={{width:20,height:20,color:'#64748b'}}/></button></div></div></header><main style={{maxWidth:500,margin:'0 auto',padding:20}}><div style={{textAlign:'center',padding:'32px 0'}}><p style={{fontSize:48,fontWeight:700,color:'#1e293b',fontFamily:'monospace',margin:0}}>{currentTime.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</p><p style={{color:'#64748b',marginTop:8}}>{currentTime.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p></div><div style={{background:'#fff',borderRadius:20,padding:20,marginBottom:16,border:`2px solid ${isAtWork?'#bbf7d0':'#fecaca'}`}}><div style={{display:'flex',alignItems:'center',gap:16}}><div style={{width:56,height:56,borderRadius:16,background:isAtWork?'#f0fdf4':'#fef2f2',display:'flex',alignItems:'center',justifyContent:'center'}}><MapPin style={{width:28,height:28,color:isAtWork?'#22c55e':'#ef4444'}}/></div><div style={{flex:1}}><p style={{fontWeight:600,color:'#1e293b',margin:0}}>Location</p><p style={{color:isAtWork?'#22c55e':'#ef4444',fontSize:14,margin:'4px 0 0',fontWeight:500}}>{location?(isAtWork?'✓ At Work':'✗ Outside'):(locationError||'Detecting...')}</p></div>{location&&<div style={{textAlign:'right'}}><p style={{color:'#94a3b8',fontSize:12,margin:0}}>Accuracy</p><p style={{color:'#1e293b',fontWeight:600,margin:0,fontFamily:'monospace'}}>{Math.round(location.accuracy)}m</p></div>}</div></div>{!isClockedIn&&<div style={{background:'#fff',borderRadius:20,padding:20,marginBottom:16}}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}><div style={{width:48,height:48,borderRadius:12,background:'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center'}}><Camera style={{width:24,height:24,color:'#8b5cf6'}}/></div><div><p style={{fontWeight:600,color:'#1e293b',margin:0}}>Selfie Verification</p><p style={{color:'#64748b',fontSize:14,margin:0}}>Required for clock-in</p></div></div>{showCamera?<div><div style={{borderRadius:16,overflow:'hidden',background:'#000',marginBottom:16}}><video ref={videoRef} autoPlay playsInline style={{width:'100%',display:'block',transform:'scaleX(-1)'}}/></div><div style={{display:'flex',gap:12}}><button onClick={()=>capturePhoto(false)} style={{flex:1,padding:14,borderRadius:12,border:'none',background:'#6366f1',color:'#fff',fontWeight:600,cursor:'pointer'}}>Capture</button><button onClick={stopCamera} style={{padding:14,borderRadius:12,border:'none',background:'#f1f5f9',cursor:'pointer'}}><X style={{width:20,height:20,color:'#64748b'}}/></button></div></div>:selfieUrl?<div><div style={{position:'relative',borderRadius:16,overflow:'hidden',marginBottom:16}}><img src={selfieUrl} alt="" style={{width:'100%',display:'block'}}/><div style={{position:'absolute',top:12,right:12,padding:'6px 12px',borderRadius:20,background:'#22c55e',color:'#fff',fontSize:12,fontWeight:600}}><CheckCircle style={{width:14,height:14,display:'inline',marginRight:4}}/>Captured</div></div><button onClick={()=>{setSelfieUrl(null);startCamera();}} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:'#f1f5f9',color:'#475569',fontWeight:600,cursor:'pointer'}}>Retake</button></div>:<button onClick={startCamera} style={{width:'100%',padding:16,borderRadius:12,border:'none',background:'linear-gradient(135deg,#8b5cf6,#6366f1)',color:'#fff',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}><Camera style={{width:20,height:20}}/>Open Camera</button>}</div>}{!isClockedIn?<button onClick={handleClockIn} disabled={!isAtWork||!selfieUrl} style={{width:'100%',padding:20,borderRadius:16,border:'none',background:isAtWork&&selfieUrl?'linear-gradient(135deg,#22c55e,#16a34a)':'#e2e8f0',color:isAtWork&&selfieUrl?'#fff':'#94a3b8',fontWeight:700,fontSize:18,cursor:isAtWork&&selfieUrl?'pointer':'not-allowed',display:'flex',alignItems:'center',justifyContent:'center',gap:12,boxShadow:isAtWork&&selfieUrl?'0 8px 24px rgba(34,197,94,0.4)':'none'}}><LogIn style={{width:24,height:24}}/>Clock In</button>:<div><div style={{background:'#fff',borderRadius:20,padding:20,marginBottom:16}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:48,height:48,borderRadius:12,background:'#f0fdf4',display:'flex',alignItems:'center',justifyContent:'center'}}><Clock style={{width:24,height:24,color:'#22c55e'}}/></div><div><p style={{color:'#64748b',fontSize:14,margin:0}}>Working Since</p><p style={{fontWeight:600,color:'#1e293b',margin:0}}>{formatTime(clockInTime)}</p></div></div><div style={{textAlign:'right'}}><p style={{color:'#64748b',fontSize:14,margin:0}}>Duration</p><p style={{fontSize:28,fontWeight:700,color:'#22c55e',margin:0,fontFamily:'monospace'}}>{formatDuration(currentTime-clockInTime-totalBreakTime)}</p></div></div></div>{!onBreak&&<div style={{background:'#fff',borderRadius:16,padding:16,marginBottom:16,border:'1px solid #e9d5ff'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:40,height:40,borderRadius:10,background:'#f5f3ff',display:'flex',alignItems:'center',justifyContent:'center'}}><Eye style={{width:20,height:20,color:'#8b5cf6'}}/></div><div><p style={{fontWeight:600,color:'#1e293b',margin:0,fontSize:14}}>Spot Checks Active</p><p style={{color:'#8b5cf6',fontSize:13,margin:0}}>Be ready</p></div></div><button onClick={triggerSpotCheck} style={{padding:'8px 12px',borderRadius:8,border:'none',background:'#f5f3ff',color:'#8b5cf6',fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:4}}><Zap style={{width:14,height:14}}/>Test</button></div></div>}{missedSpotChecks>0&&<div style={{background:'#fef2f2',borderRadius:16,padding:16,marginBottom:16,border:'1px solid #fecaca'}}><div style={{display:'flex',alignItems:'center',gap:12}}><AlertTriangle style={{width:24,height:24,color:'#ef4444'}}/><div><p style={{fontWeight:600,color:'#ef4444',margin:0}}>Missed: {missedSpotChecks}</p><p style={{color:'#64748b',fontSize:13,margin:0}}>Reported to admin</p></div></div></div>}{!onBreak?<button onClick={startBreak} style={{width:'100%',padding:16,borderRadius:16,border:'2px solid #fbbf24',background:'#fffbeb',color:'#b45309',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:16}}><Coffee style={{width:20,height:20}}/>Start Break</button>:<div style={{background:'#fffbeb',borderRadius:16,padding:20,marginBottom:16,border:'2px solid #fbbf24'}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><div style={{display:'flex',alignItems:'center',gap:12}}><Coffee style={{width:24,height:24,color:'#f59e0b'}}/><div><p style={{fontWeight:600,color:'#b45309',margin:0}}>On Break</p><p style={{color:'#64748b',fontSize:13,margin:0}}>Since {formatTime(breakStartTime)}</p></div></div><p style={{fontSize:28,fontWeight:700,color:'#f59e0b',margin:0,fontFamily:'monospace'}}>{formatDuration(currentTime-breakStartTime)}</p></div><button onClick={endBreak} style={{width:'100%',padding:14,borderRadius:12,border:'none',background:'#f59e0b',color:'#fff',fontWeight:600,cursor:'pointer'}}>End Break</button></div>}<button onClick={handleClockOut} style={{width:'100%',padding:20,borderRadius:16,border:'none',background:'linear-gradient(135deg,#ef4444,#dc2626)',color:'#fff',fontWeight:700,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:12,boxShadow:'0 8px 24px rgba(239,68,68,0.4)',marginBottom:16}}><LogOut style={{width:24,height:24}}/>Clock Out</button><div style={{background:'#fff',borderRadius:20,padding:20}}><h3 style={{fontWeight:600,color:'#1e293b',margin:'0 0 16px'}}>Today's Summary</h3><div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>{[{l:'Work',v:formatDuration(currentTime-clockInTime-totalBreakTime),c:'#1e293b'},{l:'Break',v:formatDuration(totalBreakTime+(onBreak?currentTime-breakStartTime:0)),c:'#1e293b'},{l:'Missed',v:missedSpotChecks,c:missedSpotChecks>0?'#ef4444':'#22c55e'}].map((x,i)=><div key={i} style={{background:'#f8fafc',borderRadius:12,padding:16,textAlign:'center'}}><p style={{color:'#64748b',fontSize:12,margin:0}}>{x.l}</p><p style={{fontSize:20,fontWeight:700,color:x.c,margin:'4px 0 0',fontFamily:'monospace'}}>{x.v}</p></div>)}</div></div></div>}</main></div>;

  if(view==='admin') return <div style={{minHeight:'100vh',background:'#f5f7fa'}}><style>{styles}</style><header style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'16px 20px',position:'sticky',top:0,zIndex:10}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}><div style={{display:'flex',alignItems:'center',gap:12}}><div style={{width:40,height:40,borderRadius:10,background:'linear-gradient(135deg,#f59e0b,#ea580c)',display:'flex',alignItems:'center',justifyContent:'center'}}><Shield style={{width:20,height:20,color:'#fff'}}/></div><div><p style={{fontWeight:700,color:'#1e293b',margin:0}}>GeoTrack</p><p style={{color:'#64748b',fontSize:12,margin:0}}>Admin</p></div></div><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{padding:10,borderRadius:10,background:isOnline?'#f0fdf4':'#fef2f2'}}>{isOnline?<Wifi style={{width:20,height:20,color:'#22c55e'}}/>:<WifiOff style={{width:20,height:20,color:'#ef4444'}}/>}</div><button onClick={()=>setShowExportModal(true)} style={{padding:10,borderRadius:10,border:'none',background:'#f0fdf4',cursor:'pointer'}}><Download style={{width:20,height:20,color:'#22c55e'}}/></button><button style={{position:'relative',padding:10,borderRadius:10,border:'none',background:'#f1f5f9',cursor:'pointer'}}><Bell style={{width:20,height:20,color:'#64748b'}}/>{alerts.length>0&&<span style={{position:'absolute',top:-4,right:-4,width:20,height:20,borderRadius:10,background:'#ef4444',color:'#fff',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center'}}>{alerts.length}</span>}</button><button onClick={()=>setShowChangePassword(true)} style={{padding:10,borderRadius:10,border:'none',background:'#f1f5f9',cursor:'pointer'}}><Key style={{width:20,height:20,color:'#64748b'}}/></button><button onClick={handleLogout} style={{padding:10,borderRadius:10,border:'none',background:'#f1f5f9',cursor:'pointer'}}><LogOut style={{width:20,height:20,color:'#64748b'}}/></button></div></div></header><main style={{padding:20}}><div style={{textAlign:'center',marginBottom:20}}><p style={{fontSize:24,fontWeight:700,color:'#1e293b',margin:0}}>{currentTime.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p><p style={{color:'#64748b',fontSize:14,marginTop:4}}>{currentTime.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}</p></div><button onClick={()=>setShowExportModal(true)} style={{width:'100%',padding:16,borderRadius:16,border:'none',background:'linear-gradient(135deg,#22c55e,#16a34a)',color:'#fff',fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginBottom:20,boxShadow:'0 4px 16px rgba(34,197,94,0.3)'}}><FileSpreadsheet style={{width:24,height:24}}/>Export Reports</button><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12,marginBottom:20}}>{[{n:'Employees',v:employees.length,i:<Users/>,c:'#3b82f6',b:'#eff6ff'},{n:'Working',v:employees.filter(e=>e.status==='working').length,i:<CheckCircle/>,c:'#22c55e',b:'#f0fdf4'},{n:'Checks OK',v:spotCheckLog.filter(l=>l.status==='verified').length,i:<Eye/>,c:'#8b5cf6',b:'#f5f3ff'},{n:'Alerts',v:alerts.length,i:<AlertTriangle/>,c:'#ef4444',b:'#fef2f2'}].map((x,i)=><div key={i} style={{background:'#fff',borderRadius:16,padding:20}}><div style={{width:44,height:44,borderRadius:12,background:x.b,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:12}}>{React.cloneElement(x.i,{style:{width:22,height:22,color:x.c}})}</div><p style={{fontSize:28,fontWeight:700,color:'#1e293b',margin:0}}>{x.v}</p><p style={{color:'#64748b',fontSize:14,margin:0}}>{x.n}</p></div>)}</div><div style={{background:'#fff',borderRadius:20,padding:20,marginBottom:20}}><div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}><h3 style={{fontWeight:600,color:'#1e293b',margin:0,display:'flex',alignItems:'center',gap:8}}><AlertTriangle style={{width:20,height:20,color:'#ef4444'}}/>Alerts</h3></div>{alerts.length===0?<div style={{textAlign:'center',padding:32}}><CheckCircle style={{width:48,height:48,color:'#22c55e',margin:'0 auto 12px'}}/><p style={{color:'#64748b'}}>No alerts</p></div>:<div style={{display:'flex',flexDirection:'column',gap:12}}>{alerts.slice(0,5).map(a=><div key={a.id} style={{padding:16,borderRadius:12,background:'#fef2f2',border:'1px solid #fecaca'}}><div style={{display:'flex',alignItems:'flex-start',gap:12}}><AlertTriangle style={{width:18,height:18,color:'#ef4444',flexShrink:0,marginTop:2}}/><div style={{flex:1}}><p style={{color:'#1e293b',fontWeight:500,margin:0,fontSize:14}}>{a.message}</p><p style={{color:'#64748b',fontSize:12,margin:'4px 0 0'}}>{formatDate(a.time||a.timestamp)} • {formatTime(a.time||a.timestamp)}</p></div></div></div>)}</div>}</div><div style={{background:'#fff',borderRadius:20,padding:20,marginBottom:20}}><h3 style={{fontWeight:600,color:'#1e293b',margin:'0 0 16px',display:'flex',alignItems:'center',gap:8}}><Activity style={{width:20,height:20,color:'#3b82f6'}}/>Activity</h3>{attendanceLog.length===0?<div style={{textAlign:'center',padding:32}}><Clock style={{width:48,height:48,color:'#94a3b8',margin:'0 auto 12px'}}/><p style={{color:'#64748b'}}>No activity</p></div>:<div style={{display:'flex',flexDirection:'column',gap:12}}>{attendanceLog.slice(0,10).map(l=><div key={l.id} style={{display:'flex',alignItems:'center',gap:12,padding:12,borderRadius:12,background:'#f8fafc'}}><div style={{width:36,height:36,borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',background:l.type==='clock-in'?'#f0fdf4':l.type==='clock-out'?'#fef2f2':'#fffbeb'}}>{l.type==='clock-in'&&<LogIn style={{width:18,height:18,color:'#22c55e'}}/>}{l.type==='clock-out'&&<LogOut style={{width:18,height:18,color:'#ef4444'}}/>}{(l.type==='break-start'||l.type==='break-end')&&<Coffee style={{width:18,height:18,color:'#f59e0b'}}/>}</div><div style={{flex:1}}><p style={{fontWeight:500,color:'#1e293b',margin:0,fontSize:14}}>{l.visibleToName}</p><p style={{color:'#64748b',fontSize:12,margin:0}}>{l.type.replace('-',' ')}</p></div><div style={{textAlign:'right'}}><p style={{color:'#64748b',fontSize:11,margin:0}}>{formatDate(l.time||l.timestamp)}</p><p style={{color:'#94a3b8',fontSize:12,fontFamily:'monospace'}}>{formatTime(l.time||l.timestamp)}</p></div></div>)}</div>}</div><div style={{background:'#fff',borderRadius:20,padding:20}}><h3 style={{fontWeight:600,color:'#1e293b',margin:'0 0 16px'}}>Employees</h3><div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12}}>{employees.map(e=>{const st=e.status||'offline';return<div key={e.id} style={{padding:16,borderRadius:16,background:'#f8fafc',border:'1px solid #e2e8f0'}}><div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}><div style={{width:44,height:44,borderRadius:12,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:600}}>{e.name.charAt(0)}</div><div><p style={{fontWeight:600,color:'#1e293b',margin:0,fontSize:14}}>{e.name}</p><p style={{color:'#64748b',fontSize:12,margin:0}}>{e.department}</p></div></div><span style={{padding:'4px 10px',borderRadius:20,fontSize:12,fontWeight:500,background:st==='working'?'#f0fdf4':st==='break'?'#fffbeb':'#f1f5f9',color:st==='working'?'#16a34a':st==='break'?'#b45309':'#64748b'}}>{st==='working'?'Working':st==='break'?'Break':'Offline'}</span></div>})}</div></div></main></div>;

  return null;
}
