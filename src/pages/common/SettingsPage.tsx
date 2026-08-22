import React, { useState } from 'react';
import { 
  Settings, 
  Lock, 
  Bell, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Smartphone, 
  Palette, 
  CheckCircle2, 
  Save, 
  Sparkles,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';

export const SettingsPage: React.FC = () => {
  const { user, role, logout } = useAuth();

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Notification toggles
  const [notifyAttendance, setNotifyAttendance] = useState(true);
  const [notifySchedule, setNotifySchedule] = useState(true);
  const [notifyNotices, setNotifyNotices] = useState(true);
  const [notifyCorrections, setNotifyCorrections] = useState(true);

  // Glow customization
  const [glowEffect, setGlowEffect] = useState<'emerald' | 'cyan' | 'violet'>('emerald');
  const [saveSettingsSuccess, setSaveSettingsSuccess] = useState(false);

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    setPasswordMsg({ text: 'Password successfully updated!', type: 'success' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  const handleSavePreferences = () => {
    setSaveSettingsSuccess(true);
    setTimeout(() => setSaveSettingsSuccess(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-3xl p-6 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-[#00ff88]" />
            Account & Security Settings
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your credentials, notification preferences, and active sessions
          </p>
        </div>

        {saveSettingsSuccess && (
          <div className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[#00ff88] text-xs font-bold flex items-center gap-2 animate-in zoom-in-95">
            <CheckCircle2 className="w-4 h-4" />
            <span>Preferences Saved!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card 1: Change Password & Security */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-emerald-500/15 pb-3">
            <Lock className="w-5 h-5 text-[#00ff88]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Change Account Password
            </h3>
          </div>

          {passwordMsg && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              passwordMsg.type === 'success' 
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-[#00ff88]' 
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}>
              {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              <span>{passwordMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-semibold text-slate-400 mb-1">New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-7 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3.5 py-2 text-xs bg-slate-950/80 border border-emerald-500/20 rounded-xl text-white focus:outline-none focus:border-[#00ff88]"
              />
            </div>

            <Button type="submit" variant="neon" size="sm" className="w-full mt-2">
              Update Password
            </Button>
          </form>
        </div>

        {/* Card 2: Notification Preferences */}
        <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-emerald-500/15 pb-3">
            <Bell className="w-5 h-5 text-[#00ff88]" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Alerts & Notifications
            </h3>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Daily Lecture & Schedule Alerts</h4>
                <p className="text-[11px] text-slate-400">Receive morning notification for upcoming periods</p>
              </div>
              <input
                type="checkbox"
                checked={notifySchedule}
                onChange={(e) => setNotifySchedule(e.target.checked)}
                className="w-4 h-4 accent-[#00ff88] rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Low Attendance Warning Trigger</h4>
                <p className="text-[11px] text-slate-400">Alert when attendance drops below the 75% threshold</p>
              </div>
              <input
                type="checkbox"
                checked={notifyAttendance}
                onChange={(e) => setNotifyAttendance(e.target.checked)}
                className="w-4 h-4 accent-[#00ff88] rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">College Notice Circular Broadcasts</h4>
                <p className="text-[11px] text-slate-400">Instant notification for examination and holiday circulars</p>
              </div>
              <input
                type="checkbox"
                checked={notifyNotices}
                onChange={(e) => setNotifyNotices(e.target.checked)}
                className="w-4 h-4 accent-[#00ff88] rounded cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-emerald-500/15 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Correction Status Updates</h4>
                <p className="text-[11px] text-slate-400">Alerts when faculty approves or rejects a rectification</p>
              </div>
              <input
                type="checkbox"
                checked={notifyCorrections}
                onChange={(e) => setNotifyCorrections(e.target.checked)}
                className="w-4 h-4 accent-[#00ff88] rounded cursor-pointer"
              />
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleSavePreferences} className="w-full">
            Save Notification Settings
          </Button>
        </div>

        {/* Card 3: Active Device & Session Info */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 sm:p-7 border border-emerald-500/20 space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-500/15 pb-3">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-[#00ff88]" />
              <h3 className="text-sm font-bold text-white tracking-wide">
                Active Devices & Security Sessions
              </h3>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              leftIcon={<LogOut className="w-3.5 h-3.5 text-rose-400" />}
              className="text-rose-400 hover:text-rose-300 text-xs"
            >
              Sign Out from All Devices
            </Button>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950/70 border border-emerald-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-[#00ff88]">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-white block">Current Web Browser Session</span>
                <span className="text-slate-400 text-[11px]">macOS / Chrome • Aligarh, Uttar Pradesh</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
              <span className="font-bold text-emerald-400 font-mono text-[11px]">Online Now</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
