import { useState, useEffect } from 'react';
import { auth } from './firebase';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { signOut, deleteUser } from 'firebase/auth';
import './modern.css';

// Helper to get days in a month
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

const bonusOptions = [
  { label: 'No Bonus', value: 0 },
  { label: '30% Bonus', value: 0.3 },
  { label: '50% Bonus', value: 0.5 },
  { label: '200% Bonus (Sunday)', value: 2.0 },
];

const HUF_TO_INR = 0.23; // Example rate, update as needed
const TAX_RATE = 0.335;

export default function SalaryCalculator() {
  // Theme state for dark/light mode
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  const today = new Date();
  // Firestore sync state
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hourly, setHourly] = useState(0);
  type DayEntry = { hours: number; bonus: number };
  const [days, setDays] = useState<{ [day: number]: DayEntry[] }>({});
  const [loadingCloud, setLoadingCloud] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [modalDay, setModalDay] = useState<number | null>(null);
  const [modalEntries, setModalEntries] = useState<DayEntry[]>([]);
  const [showInINR, setShowInINR] = useState(false);
  const [applyTax, setApplyTax] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Firestore sync: load on mount, save on change
  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        setLoadingCloud(false);
        setInitialLoad(false);
        return;
      }
      setLoadingCloud(true);
      try {
        const db = getFirestore();
        const ref = doc(db, 'salaryData', auth.currentUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setYear(data.year ?? today.getFullYear());
          setMonth(data.month ?? today.getMonth());
          setHourly(data.hourly ?? 0);
          setDays(data.days ?? {});
        } else {
          // New user: set defaults
          setYear(today.getFullYear());
          setMonth(today.getMonth());
          setHourly(0);
          setDays({});
        }
      } catch (e: unknown) {
        console.error('Error fetching data:', e);
        setYear(today.getFullYear());
        setMonth(today.getMonth());
        setHourly(0);
        setDays({});
      } finally {
        setLoadingCloud(false);
        setInitialLoad(false);
      }
    };
    fetchData();
    // Only run on mount or when user changes
    // eslint-disable-next-line
  }, [auth.currentUser?.uid]);

  useEffect(() => {
    if (!auth.currentUser) return;
    if (loadingCloud || initialLoad) return;
    const db = getFirestore();
    const ref = doc(db, 'salaryData', auth.currentUser.uid);
    (async () => {
      try {
        console.log('Saving to Firestore:', { year, month, hourly, days });
        await setDoc(ref, { year, month, hourly, days });
        console.log('Saved to Firestore successfully');
      } catch (err) {
        console.error('Error saving to Firestore:', err);
      }
    })();
  }, [year, month, hourly, days, loadingCloud, initialLoad]);

  const daysInMonth = getDaysInMonth(year, month);

  // Calculate total salary
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const entries = days[d] || [];
    for (const entry of entries) {
      const base = entry.hours * hourly;
      const bonus = base * entry.bonus;
      total += base + bonus;
    }
  }
  const taxed = applyTax ? total * (1 - TAX_RATE) : total;
  const display = showInINR ? taxed * HUF_TO_INR : taxed;

  // Modal handlers
  const openModal = (d: number) => {
    setModalDay(d);
    setModalEntries(days[d] ? [...days[d]] : []);
  };
  const closeModal = () => {
    setModalDay(null);
    setModalEntries([]);
  };
  const saveModal = () => {
    setDays(prev => {
      const newDays = { ...prev, [modalDay!]: modalEntries.filter(e => e.hours > 0) };
      return newDays;
    });
    closeModal();
  };
  const addModalEntry = (isSunday: boolean) => {
    setModalEntries(prev => [...prev, { hours: 0, bonus: isSunday ? 2.0 : 0 }]);
  };
  const updateModalEntry = (idx: number, field: 'hours' | 'bonus', value: number) => {
    setModalEntries(prev => prev.map((entry, i) => i === idx ? { ...entry, [field]: value } : entry));
  };
  const removeModalEntry = (idx: number) => {
    setModalEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // Auth handlers
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!auth.currentUser) return;
    
    try {
      // Delete user data from Firestore
      const db = getFirestore();
      const ref = doc(db, 'salaryData', auth.currentUser.uid);
      await deleteDoc(ref);
      
      // Delete the user account
      await deleteUser(auth.currentUser);
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Error deleting account. Please try again.');
    }
  };

  if (loadingCloud) {
    return (
      <div className="mg-salary-bg">
        <div className="mg-salary-loading">
          <div className="mg-loading-card">
            <div className="mg-loading-content">Loading cloud data...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mg-salary-bg">
      <div className="mg-salary-container">
        <div className="mg-salary-card">
          <div className="mg-salary-header">
            <h2 className="mg-salary-title">SALARY TRACKER</h2>
            <div className="mg-salary-subtitle">Monthly earnings calculator</div>
            
            {auth.currentUser && (
              <div className="mg-user-greeting">
                👋 Hi, {auth.currentUser.email?.split('@')[0] || 'User'}!
              </div>
            )}
            
            <div className="mg-theme-toggle">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="mg-theme-btn"
              >
                {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
              </button>
            </div>
            
            <div className="mg-account-actions">
              <button
                onClick={handleLogout}
                className="mg-logout-btn"
                title="Sign out"
              >
                🚪 Logout
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mg-delete-btn"
                title="Delete account permanently"
              >
                🗑️ Delete Account
              </button>
            </div>
          </div>
          
          <div className="mg-salary-form">
            <div className="mg-salary-input-group">
              <label className="mg-salary-label">Hourly Wage (HUF)</label>
              <input 
                type="number" 
                value={hourly} 
                onChange={e => setHourly(Number(e.target.value))} 
                min={0} 
                className="mg-salary-input" 
                placeholder="e.g. 2000" 
              />
            </div>
            
            <div className="mg-salary-input-row">
              <div className="mg-salary-input-group">
                <label className="mg-salary-label">Month</label>
                <select 
                  value={month} 
                  onChange={e => setMonth(Number(e.target.value))} 
                  className="mg-salary-input"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i}>
                      {new Date(year, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mg-salary-input-group">
                <label className="mg-salary-label">Year</label>
                <input 
                  type="number" 
                  value={year} 
                  onChange={e => setYear(Number(e.target.value))} 
                  min={2000} 
                  max={2100} 
                  className="mg-salary-input" 
                  placeholder="e.g. 2025" 
                />
              </div>
            </div>
          </div>
          
          <div className="mg-salary-calendar">
            <div className="mg-calendar-header">
              <h3 className="mg-calendar-title">Work Schedule</h3>
              <div className="mg-calendar-month">
                {new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
            </div>
            
            <div className="mg-calendar-grid">
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const date = new Date(year, month, d);
                const weekday = date.toLocaleString('default', { weekday: 'short' });
                const isSunday = date.getDay() === 0;
                const isToday = (date.getFullYear() === new Date().getFullYear() && 
                               date.getMonth() === new Date().getMonth() && 
                               date.getDate() === new Date().getDate());
                
                const dayEntries = days[d] || [];
                const hasEntries = dayEntries.length > 0;
                
                let dayClass = 'mg-calendar-day';
                if (isSunday) dayClass += ' mg-calendar-sunday';
                if (isToday) dayClass += ' mg-calendar-today';
                if (hasEntries) dayClass += ' mg-calendar-has-entries';
                
                return (
                  <div key={d} className={dayClass} onClick={() => openModal(d)}>
                    <div className="mg-day-number">{d}</div>
                    <div className="mg-day-weekday">{weekday}</div>
                    {hasEntries && (
                      <div className="mg-day-entries">
                        {dayEntries.map((entry, idx) => (
                          <div key={idx} className="mg-day-entry">
                            {entry.hours}h
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="mg-salary-options">
            <label className="mg-salary-checkbox">
              <input 
                type="checkbox" 
                checked={applyTax} 
                onChange={e => setApplyTax(e.target.checked)} 
              />
              <span className="mg-checkbox-text">Apply 33.5% Tax</span>
            </label>
            <label className="mg-salary-checkbox">
              <input 
                type="checkbox" 
                checked={showInINR} 
                onChange={e => setShowInINR(e.target.checked)} 
              />
              <span className="mg-checkbox-text">Show in INR</span>
            </label>
          </div>
          
          <div className="mg-salary-total">
            <div className="mg-total-label">Total Salary</div>
            <div className="mg-total-amount">
              {display.toLocaleString(undefined, { maximumFractionDigits: 2 })} {showInINR ? 'INR' : 'HUF'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal for adding/editing entries for a day */}
      {modalDay !== null && (
        <div className="mg-modal-bg" onClick={closeModal}>
          <div className="mg-modal-card" onClick={e => e.stopPropagation()}>
            <div className="mg-modal-header">
              <h3 className="mg-modal-title">Edit Day {modalDay}</h3>
              <div className="mg-modal-subtitle">
                {new Date(year, month, modalDay).toLocaleDateString('default', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
            
            <div className="mg-modal-content">
              {modalEntries.length === 0 && (
                <div className="mg-modal-empty">No entries yet for this day</div>
              )}
              
              {modalEntries.map((entry, idx) => (
                <div key={idx} className="mg-modal-entry">
                  <div className="mg-modal-entry-row">
                    <div className="mg-modal-input-group">
                      <label className="mg-modal-label">Hours</label>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={entry.hours}
                        onChange={e => updateModalEntry(idx, 'hours', Number(e.target.value))}
                        className="mg-modal-input mg-modal-input-small"
                        placeholder="8"
                      />
                    </div>
                    
                    <div className="mg-modal-input-group mg-modal-input-group-flex">
                      <label className="mg-modal-label">Bonus Type</label>
                      <select
                        value={entry.bonus}
                        onChange={e => updateModalEntry(idx, 'bonus', Number(e.target.value))}
                        className="mg-modal-input"
                      >
                        {bonusOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button 
                      onClick={() => removeModalEntry(idx)}
                      className="mg-modal-remove-btn"
                      title="Remove entry"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => addModalEntry(new Date(year, month, modalDay).getDay() === 0)} 
                className="mg-modal-add-btn"
              >
                + Add Work Entry
              </button>
            </div>
            
            <div className="mg-modal-actions">
              <button onClick={saveModal} className="mg-modal-btn mg-modal-btn-save">
                Save Changes
              </button>
              <button onClick={closeModal} className="mg-modal-btn mg-modal-btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="mg-modal-bg" onClick={() => setShowDeleteConfirm(false)}>
          <div className="mg-delete-modal-card" onClick={e => e.stopPropagation()}>
            <div className="mg-delete-modal-header">
              <h3 className="mg-delete-modal-title">⚠️ Delete Account</h3>
              <div className="mg-delete-modal-subtitle">
                This action cannot be undone
              </div>
            </div>
            
            <div className="mg-delete-modal-content">
              <p className="mg-delete-warning">
                Are you sure you want to permanently delete your account?
              </p>
              <p className="mg-delete-details">
                This will delete:
              </p>
              <ul className="mg-delete-list">
                <li>• All your salary tracking data</li>
                <li>• Your account credentials</li>
                <li>• All work entries and calculations</li>
              </ul>
            </div>
            
            <div className="mg-delete-modal-actions">
              <button 
                onClick={handleDeleteAccount} 
                className="mg-modal-btn mg-delete-confirm-btn"
              >
                Yes, Delete Everything
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(false)} 
                className="mg-modal-btn mg-modal-btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        /* Reset any inherited styles */
        html, body {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          width: 100vw;
          height: 100vh;
          overflow-x: hidden;
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        
        /* Mobile viewport fix */
        @supports (-webkit-touch-callout: none) {
          .mg-salary-bg {
            min-height: -webkit-fill-available;
          }
        }
        
        .mg-salary-bg {
          min-height: 100vh;
          min-height: -webkit-fill-available; /* iOS Safari fix */
          width: 100vw;
          max-width: 100vw;
          background: ${theme === 'dark' 
            ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 25%, #2a2a2a 50%, #3a3a3a 75%, #4a4a4a 100%)'
            : 'linear-gradient(135deg, #f5f5f5 0%, #e5e5e5 25%, #d5d5d5 50%, #c5c5c5 75%, #b5b5b5 100%)'
          };
          background-size: 300% 300%;
          animation: subtleGradient 35s ease infinite;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          overflow-x: hidden;
          padding: 20px;
          margin: 0;
          box-sizing: border-box;
          position: fixed;
          top: 0;
          left: 0;
          -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
        }
        
        .mg-salary-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${theme === 'dark' 
            ? `radial-gradient(circle at 15% 15%, rgba(70, 70, 70, 0.4) 0%, transparent 50%),
               radial-gradient(circle at 85% 85%, rgba(50, 50, 50, 0.3) 0%, transparent 50%),
               radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.2) 0%, transparent 70%),
               linear-gradient(45deg, rgba(10, 10, 10, 0.3) 0%, transparent 100%)`
            : `radial-gradient(circle at 15% 15%, rgba(150, 150, 150, 0.3) 0%, transparent 50%),
               radial-gradient(circle at 85% 85%, rgba(180, 180, 180, 0.2) 0%, transparent 50%),
               radial-gradient(circle at 50% 50%, rgba(200, 200, 200, 0.15) 0%, transparent 70%),
               linear-gradient(45deg, rgba(245, 245, 245, 0.2) 0%, transparent 100%)`
          };
          animation: gentleShimmer 45s ease-in-out infinite;
          pointer-events: none;
        }
        
        @keyframes subtleGradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes gentleShimmer {
          0%, 100% {
            opacity: 0.7;
            transform: translateY(0px) scale(1);
          }
          33% {
            opacity: 0.85;
            transform: translateY(-8px) scale(1.02);
          }
          66% {
            opacity: 0.9;
            transform: translateY(-3px) scale(1.01);
          }
        }
        
        .mg-salary-container {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 800px;
        }
        
        .mg-salary-card {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.07)' 
            : 'rgba(255, 255, 255, 0.9)'
          };
          backdrop-filter: blur(30px);
          border-radius: 28px;
          box-shadow: ${theme === 'dark'
            ? `0 12px 40px 0 rgba(0, 0, 0, 0.35),
               inset 0 2px 0 rgba(255, 255, 255, 0.12),
               inset 0 -1px 0 rgba(0, 0, 0, 0.1)`
            : `0 12px 40px 0 rgba(0, 0, 0, 0.15),
               inset 0 2px 0 rgba(255, 255, 255, 0.8),
               inset 0 -1px 0 rgba(0, 0, 0, 0.05)`
          };
          width: 100%;
          max-width: 700px;
          display: flex;
          flex-direction: column;
          position: relative;
          padding: 40px 35px 35px 35px;
          box-sizing: border-box;
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.12)' 
            : 'rgba(255, 255, 255, 0.5)'
          };
          transition: all 0.3s ease;
          max-height: 85vh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
        }
        
        .mg-salary-card:hover {
          transform: translateY(-2px);
          box-shadow: ${theme === 'dark'
            ? `0 16px 48px 0 rgba(0, 0, 0, 0.4),
               inset 0 2px 0 rgba(255, 255, 255, 0.15),
               inset 0 -1px 0 rgba(0, 0, 0, 0.1)`
            : `0 16px 48px 0 rgba(0, 0, 0, 0.2),
               inset 0 2px 0 rgba(255, 255, 255, 0.9),
               inset 0 -1px 0 rgba(0, 0, 0, 0.05)`
          };
        }
        
        .mg-salary-header {
          text-align: center;
          margin-bottom: 25px;
          position: relative;
        }
        
        .mg-salary-title {
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: 2px;
          margin: 0 0 0.2em 0;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-shadow: ${theme === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.5)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-salary-subtitle {
          font-size: 0.95rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.8)' 
            : 'rgba(30, 41, 59, 0.8)'
          };
          font-style: italic;
          margin-bottom: 15px;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 4px rgba(0, 0, 0, 0.3)' 
            : '0 1px 4px rgba(0, 0, 0, 0.1)'
          };
          font-weight: 300;
        }
        
        .mg-user-greeting {
          font-size: 1rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.9)' 
            : 'rgba(30, 41, 59, 0.9)'
          };
          font-weight: 600;
          margin-bottom: 15px;
          padding: 8px 16px;
          background: ${theme === 'dark' 
            ? 'rgba(34, 197, 94, 0.15)' 
            : 'rgba(34, 197, 94, 0.1)'
          };
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(34, 197, 94, 0.3)' 
            : 'rgba(34, 197, 94, 0.2)'
          };
          border-radius: 12px;
          text-align: center;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
          backdrop-filter: blur(10px);
          letter-spacing: 0.3px;
        }
        
        .mg-theme-toggle {
          margin-top: 15px;
        }
        
        .mg-account-actions {
          margin-top: 15px;
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }
        
        .mg-theme-btn {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(30, 41, 59, 0.1)'
          };
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(30, 41, 59, 0.2)'
          };
          border-radius: 12px;
          padding: 8px 16px;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }
        
        .mg-theme-btn:hover {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.15)' 
            : 'rgba(30, 41, 59, 0.15)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.3)' 
            : 'rgba(30, 41, 59, 0.3)'
          };
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .mg-logout-btn {
          background: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.15)' 
            : 'rgba(59, 130, 246, 0.1)'
          };
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.3)' 
            : 'rgba(59, 130, 246, 0.2)'
          };
          border-radius: 10px;
          padding: 6px 12px;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }
        
        .mg-logout-btn:hover {
          background: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.25)' 
            : 'rgba(59, 130, 246, 0.15)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.5)' 
            : 'rgba(59, 130, 246, 0.3)'
          };
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
        }
        
        .mg-delete-btn {
          background: ${theme === 'dark' 
            ? 'rgba(239, 68, 68, 0.15)' 
            : 'rgba(239, 68, 68, 0.1)'
          };
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(239, 68, 68, 0.3)' 
            : 'rgba(239, 68, 68, 0.2)'
          };
          border-radius: 10px;
          padding: 6px 12px;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }
        
        .mg-delete-btn:hover {
          background: ${theme === 'dark' 
            ? 'rgba(239, 68, 68, 0.25)' 
            : 'rgba(239, 68, 68, 0.15)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(239, 68, 68, 0.5)' 
            : 'rgba(239, 68, 68, 0.3)'
          };
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);
        }
        
        .mg-salary-form {
          margin-bottom: 30px;
        }
        
        .mg-salary-input-group {
          margin-bottom: 20px;
        }
        
        .mg-salary-input-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        
        .mg-salary-label {
          display: block;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.9)' 
            : 'rgba(30, 41, 59, 0.9)'
          };
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 0.9rem;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-salary-input {
          width: 100%;
          border-radius: 14px;
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(30, 41, 59, 0.2)'
          };
          padding: 14px 18px;
          font-size: 0.95rem;
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(255, 255, 255, 0.8)'
          };
          backdrop-filter: blur(10px);
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-weight: 500;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        
        .mg-salary-input:focus {
          border-color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.4)' 
            : 'rgba(30, 41, 59, 0.4)'
          };
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.15)' 
            : 'rgba(255, 255, 255, 0.9)'
          };
          box-shadow: ${theme === 'dark' 
            ? '0 0 20px rgba(255, 255, 255, 0.1)' 
            : '0 0 20px rgba(30, 41, 59, 0.1)'
          };
        }
        
        .mg-salary-input::placeholder {
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(30, 41, 59, 0.6)'
          };
          font-weight: 400;
        }
        
        .mg-calendar-header {
          text-align: center;
          margin-bottom: 20px;
        }
        
        .mg-calendar-title {
          font-size: 1.3rem;
          font-weight: 700;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          margin: 0 0 6px 0;
          text-shadow: ${theme === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.4)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-calendar-month {
          font-size: 1rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.8)' 
            : 'rgba(30, 41, 59, 0.8)'
          };
          font-weight: 500;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-calendar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
          gap: 8px;
          margin-bottom: 30px;
        }
        
        .mg-calendar-day {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 12px 8px;
          cursor: pointer;
          transition: all 0.3s ease;
          text-align: center;
          min-height: 65px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        
        .mg-calendar-day:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .mg-calendar-today {
          background: rgba(96, 165, 250, 0.2) !important;
          border-color: rgba(96, 165, 250, 0.4) !important;
          box-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
        }
        
        .mg-calendar-sunday {
          background: rgba(248, 113, 113, 0.15);
          border-color: rgba(248, 113, 113, 0.3);
        }
        
        .mg-calendar-has-entries {
          background: rgba(34, 197, 94, 0.15);
          border-color: rgba(34, 197, 94, 0.3);
        }
        
        .mg-day-number {
          font-size: 1rem;
          font-weight: 700;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          margin-bottom: 3px;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.4)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-day-weekday {
          font-size: 0.7rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.7)' 
            : 'rgba(30, 41, 59, 0.7)'
          };
          font-weight: 500;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        
        .mg-day-entries {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          justify-content: center;
        }
        
        .mg-day-entry {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(30, 41, 59, 0.2)'
          };
          border-radius: 6px;
          padding: 1px 4px;
          font-size: 0.6rem;
          font-weight: 600;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-shadow: ${theme === 'dark' 
            ? '0 1px 2px rgba(0, 0, 0, 0.3)' 
            : '0 1px 2px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-salary-options {
          display: flex;
          gap: 25px;
          justify-content: center;
          margin-bottom: 25px;
          flex-wrap: wrap;
        }
        
        .mg-salary-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 500;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.9)' 
            : 'rgba(30, 41, 59, 0.9)'
          };
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-salary-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: rgba(96, 165, 250, 0.8);
        }
        
        .mg-checkbox-text {
          font-size: 0.9rem;
          letter-spacing: 0.2px;
        }
        
        .mg-salary-total {
          text-align: center;
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.08)' 
            : 'rgba(255, 255, 255, 0.6)'
          };
          backdrop-filter: blur(20px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.15)' 
            : 'rgba(255, 255, 255, 0.5)'
          };
          border-radius: 18px;
          padding: 25px;
          box-shadow: ${theme === 'dark'
            ? `0 8px 32px rgba(0, 0, 0, 0.3),
               inset 0 1px 0 rgba(255, 255, 255, 0.1)`
            : `0 8px 32px rgba(0, 0, 0, 0.1),
               inset 0 1px 0 rgba(255, 255, 255, 0.8)`
          };
        }
        
        .mg-total-label {
          font-size: 1rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.8)' 
            : 'rgba(30, 41, 59, 0.8)'
          };
          font-weight: 600;
          margin-bottom: 10px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 3px rgba(0, 0, 0, 0.3)' 
            : '0 1px 3px rgba(0, 0, 0, 0.1)'
          };
        }
        
        .mg-total-amount {
          font-size: 2rem;
          font-weight: 800;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-shadow: ${theme === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.4)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)'
          };
          letter-spacing: 0.5px;
        }
        
        .mg-salary-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          z-index: 2;
        }
        
        .mg-loading-card {
          background: rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(30px);
          border-radius: 28px;
          box-shadow: 
            0 12px 40px 0 rgba(0, 0, 0, 0.35),
            inset 0 2px 0 rgba(255, 255, 255, 0.12);
          padding: 50px 80px;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        
        .mg-loading-content {
          font-size: 1.2rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
          text-align: center;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        /* Modal Styles */
        .mg-modal-bg {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          padding: 20px;
        }
        
        .mg-modal-card {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 24px;
          box-shadow: 
            0 16px 48px 0 rgba(0, 0, 0, 0.4),
            inset 0 2px 0 rgba(255, 255, 255, 0.1);
          padding: 40px;
          width: 100%;
          max-width: 500px;
          max-height: 80vh;
          overflow-y: auto;
          color: #ffffff;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
        }
        
        .mg-modal-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .mg-modal-title {
          font-size: 1.8rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }
        
        .mg-modal-subtitle {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 500;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .mg-modal-content {
          margin-bottom: 30px;
        }
        
        .mg-modal-empty {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          font-style: italic;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        
        .mg-modal-entry {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
        }
        
        .mg-modal-entry-row {
          display: grid;
          grid-template-columns: 1fr 2fr auto;
          gap: 16px;
          align-items: end;
        }
        
        .mg-modal-input-group {
          display: flex;
          flex-direction: column;
        }
        
        .mg-modal-input-group-flex {
          flex: 1;
        }
        
        .mg-modal-label {
          color: rgba(255, 255, 255, 0.8);
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 0.9rem;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .mg-modal-input {
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 12px 16px;
          font-size: 0.95rem;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          color: #ffffff;
          font-weight: 500;
          outline: none;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }
        
        .mg-modal-input-small {
          max-width: 80px;
        }
        
        .mg-modal-input:focus {
          border-color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.15);
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.1);
        }
        
        .mg-modal-remove-btn {
          background: rgba(248, 113, 113, 0.2);
          border: 1px solid rgba(248, 113, 113, 0.3);
          border-radius: 8px;
          color: #ffffff;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          padding: 8px 12px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        
        .mg-modal-remove-btn:hover {
          background: rgba(248, 113, 113, 0.3);
          border-color: rgba(248, 113, 113, 0.5);
          transform: translateY(-1px);
        }
        
        .mg-modal-add-btn {
          width: 100%;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.3);
          border-radius: 14px;
          color: #ffffff;
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          padding: 16px 24px;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
          margin-bottom: 10px;
        }
        
        .mg-modal-add-btn:hover {
          background: rgba(34, 197, 94, 0.3);
          border-color: rgba(34, 197, 94, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .mg-modal-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
        }
        
        .mg-modal-btn {
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.3);
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          color: #ffffff;
          font-size: 1rem;
          font-weight: 600;
          padding: 14px 28px;
          cursor: pointer;
          transition: all 0.3s ease;
          min-width: 120px;
        }
        
        .mg-modal-btn-save {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.4);
        }
        
        .mg-modal-btn-save:hover {
          background: rgba(34, 197, 94, 0.3);
          border-color: rgba(34, 197, 94, 0.6);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .mg-modal-btn-cancel:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        /* Delete Account Modal Styles */
        .mg-delete-modal-card {
          background: rgba(239, 68, 68, 0.1);
          backdrop-filter: blur(30px);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 24px;
          box-shadow: 
            0 16px 48px 0 rgba(239, 68, 68, 0.4),
            inset 0 2px 0 rgba(255, 255, 255, 0.1);
          padding: 40px;
          width: 100%;
          max-width: 450px;
          max-height: 80vh;
          overflow-y: auto;
          color: #ffffff;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
        }
        
        .mg-delete-modal-header {
          text-align: center;
          margin-bottom: 25px;
        }
        
        .mg-delete-modal-title {
          font-size: 1.6rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 8px 0;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        }
        
        .mg-delete-modal-subtitle {
          font-size: 0.9rem;
          color: rgba(255, 255, 255, 0.8);
          font-weight: 500;
          font-style: italic;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .mg-delete-modal-content {
          margin-bottom: 30px;
          text-align: left;
        }
        
        .mg-delete-warning {
          font-size: 1.1rem;
          color: #ffffff;
          font-weight: 600;
          margin-bottom: 20px;
          text-align: center;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
        }
        
        .mg-delete-details {
          font-size: 1rem;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          margin-bottom: 15px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .mg-delete-list {
          color: rgba(255, 255, 255, 0.8);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
          padding-left: 0;
          list-style: none;
        }
        
        .mg-delete-list li {
          margin-bottom: 8px;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .mg-delete-modal-actions {
          display: flex;
          gap: 16px;
          justify-content: center;
          flex-direction: column;
        }
        
        .mg-delete-confirm-btn {
          background: rgba(239, 68, 68, 0.3) !important;
          border-color: rgba(239, 68, 68, 0.5) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        
        .mg-delete-confirm-btn:hover {
          background: rgba(239, 68, 68, 0.4) !important;
          border-color: rgba(239, 68, 68, 0.7) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4) !important;
        }
        
        /* Custom Scrollbar Styling */
        .mg-salary-card::-webkit-scrollbar {
          width: 8px;
        }
        
        .mg-salary-card::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        
        .mg-salary-card::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }
        
        .mg-salary-card::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
        }
        
        .mg-modal-card::-webkit-scrollbar {
          width: 6px;
        }
        
        .mg-modal-card::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        
        .mg-modal-card::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        }
        
        .mg-modal-card::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.2);
        }
        
        /* Firefox scrollbar */
        .mg-salary-card {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
        }
        
        .mg-modal-card {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
        }

        @media (max-width: 768px) {
          .mg-salary-bg {
            padding: 10px;
          }
          
          .mg-salary-card {
            margin: 5px;
            padding: 25px 20px;
            max-height: 95vh;
            border-radius: 20px;
            max-width: 100%;
          }
          
          .mg-salary-title {
            font-size: 1.4rem;
            letter-spacing: 1px;
          }
          
          .mg-salary-subtitle {
            font-size: 0.85rem;
          }
          
          .mg-user-greeting {
            font-size: 0.9rem;
            padding: 6px 12px;
            border-radius: 10px;
            margin-bottom: 12px;
          }
          
          .mg-theme-btn {
            padding: 6px 12px;
            font-size: 0.75rem;
          }
          
          .mg-logout-btn,
          .mg-delete-btn {
            padding: 6px 10px;
            font-size: 0.7rem;
          }
          
          .mg-account-actions {
            gap: 8px;
          }
          
          .mg-salary-input-row {
            grid-template-columns: 1fr;
            gap: 14px;
          }
          
          .mg-salary-input {
            padding: 12px 14px;
            font-size: 16px; /* Prevents zoom on iOS */
          }
          
          .mg-calendar-grid {
            grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
            gap: 6px;
          }
          
          .mg-calendar-day {
            min-height: 50px;
            padding: 6px 4px;
            border-radius: 8px;
          }
          
          .mg-day-number {
            font-size: 0.9rem;
            margin-bottom: 2px;
          }
          
          .mg-day-weekday {
            font-size: 0.6rem;
            margin-bottom: 4px;
          }
          
          .mg-day-entry {
            font-size: 0.55rem;
            padding: 1px 3px;
          }
          
          .mg-salary-options {
            flex-direction: column;
            gap: 12px;
            align-items: center;
          }
          
          .mg-salary-checkbox {
            font-size: 0.85rem;
          }
          
          .mg-salary-checkbox input[type="checkbox"] {
            width: 16px;
            height: 16px;
          }
          
          .mg-salary-total {
            padding: 20px 15px;
            border-radius: 14px;
          }
          
          .mg-total-label {
            font-size: 0.9rem;
            margin-bottom: 8px;
          }
          
          .mg-total-amount {
            font-size: 1.5rem;
            line-height: 1.2;
          }
          
          .mg-modal-card {
            margin: 5px;
            padding: 20px 15px;
            border-radius: 18px;
            max-width: calc(100vw - 20px);
          }
          
          .mg-delete-modal-card {
            margin: 5px;
            padding: 25px 20px;
            border-radius: 18px;
            max-width: calc(100vw - 20px);
          }
          
          .mg-modal-title {
            font-size: 1.4rem;
          }
          
          .mg-modal-subtitle {
            font-size: 0.9rem;
          }
          
          .mg-modal-entry {
            padding: 15px;
            border-radius: 12px;
          }
          
          .mg-modal-entry-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          
          .mg-modal-input {
            padding: 10px 12px;
            font-size: 16px; /* Prevents zoom on iOS */
          }
          
          .mg-modal-input-small {
            max-width: 100%;
          }
          
          .mg-modal-add-btn {
            padding: 12px 20px;
            font-size: 0.9rem;
            border-radius: 12px;
          }
          
          .mg-modal-btn {
            padding: 12px 20px;
            font-size: 0.9rem;
            min-width: 100px;
            border-radius: 12px;
          }
          
          .mg-modal-actions {
            flex-direction: column;
            gap: 12px;
          }
          
          .mg-modal-remove-btn {
            padding: 6px 10px;
            font-size: 0.9rem;
          }
          
          /* Mobile scrollbar adjustments */
          .mg-salary-card::-webkit-scrollbar {
            width: 4px;
          }
          
          .mg-modal-card::-webkit-scrollbar {
            width: 3px;
          }
          
          /* Touch-friendly improvements */
          .mg-calendar-day {
            min-height: 55px; /* Larger touch targets */
          }
          
          .mg-theme-btn,
          .mg-logout-btn,
          .mg-delete-btn,
          .mg-modal-btn,
          .mg-modal-add-btn,
          .mg-modal-remove-btn {
            min-height: 44px; /* iOS recommended touch target */
          }
          
          /* Android specific optimizations */
          .mg-salary-input,
          .mg-modal-input {
            -webkit-appearance: none;
            appearance: none;
          }
          
          .mg-salary-input[type="number"],
          .mg-modal-input[type="number"] {
            -moz-appearance: textfield;
          }
          
          .mg-salary-input[type="number"]::-webkit-outer-spin-button,
          .mg-salary-input[type="number"]::-webkit-inner-spin-button,
          .mg-modal-input[type="number"]::-webkit-outer-spin-button,
          .mg-modal-input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}