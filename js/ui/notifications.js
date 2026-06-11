// Notification Module — Email & SMS Previews + Toast System
import { getAlerts } from '../engine/alerts.js';

let toastContainer = null;

export function initNotifications() {
  // Create toast container
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  document.body.appendChild(toastContainer);
}

export function showToast(message, level = 'green', duration = 5000) {
  if (!toastContainer) initNotifications();
  const toast = document.createElement('div');
  toast.className = `toast ${level}`;
  toast.innerHTML = `
    <div class="toast-title">${level === 'red' ? '🔴 Critical Alert' : level === 'orange' ? '🟠 Alert' : level === 'yellow' ? '🟡 Warning' : '✅ Notice'}</div>
    <div class="toast-body">${message}</div>
  `;
  toastContainer.appendChild(toast);
  toast.addEventListener('click', () => toast.remove());
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function showNotificationModal(container, alertData = null) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const alerts = alertData ? [alertData] : getAlerts({ hideDismissed: true }).filter(a => a.level === 'red' || a.level === 'orange').slice(0, 3);
  const subject = alerts.length > 0 ? `Critical Turbine Alert — ${alerts[0].turbineId}` : 'APGCL Turbine Health Alert';

  overlay.innerHTML = `
    <div class="modal">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-5)">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary)">📬 Notification Preview</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">Email & SMS alert simulation</div>
        </div>
        <button class="btn btn-outline btn-sm" id="close-modal">✕ Close</button>
      </div>

      <!-- Email Preview -->
      <div style="margin-bottom:var(--space-5)">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--space-3)">📧 Gmail Alert</div>
        <div class="email-preview">
          <div class="email-header-bar">
            <div class="email-dot" style="background:#ff5f57"></div>
            <div class="email-dot" style="background:#febc2e"></div>
            <div class="email-dot" style="background:#28c840"></div>
            <span style="margin-left:var(--space-3);font-size:12px;color:var(--text-secondary)">APGCL Alert System — Gmail</span>
          </div>
          <div class="email-body">
            <div class="email-field"><span class="email-field-label">From:</span><span class="email-field-value">alerts@apgcl-monitoring.in</span></div>
            <div class="email-field"><span class="email-field-label">To:</span><span class="email-field-value">maintenance-team@apgcl.in</span></div>
            <div class="email-field"><span class="email-field-label">Subject:</span><span class="email-field-value" style="color:var(--red);font-weight:700">[CRITICAL] ${subject}</span></div>
            <hr class="email-divider">
            <div style="color:var(--text-primary);font-weight:600;margin-bottom:var(--space-3)">⚠️ APGCL Turbine Health Monitoring System — Critical Alert</div>
            ${alerts.slice(0, 2).map(a => `
              <div style="background:var(--red-bg);border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:var(--space-3);margin-bottom:var(--space-3)">
                <div style="font-weight:700;color:var(--red);margin-bottom:4px">${a.turbineId} — ${a.paramLabel}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${a.message}</div>
                ${a.daysToBreach ? `<div style="font-size:12px;color:var(--orange);margin-top:4px;font-weight:600">⏱ OEM limit breach predicted in ${a.daysToBreach} days</div>` : ''}
              </div>
            `).join('')}
            <div style="margin-top:var(--space-4);font-size:12px;color:var(--text-muted)">
              This is an automated alert from the APGCL AI Turbine Health Monitoring System.<br>
              Login at: <span style="color:var(--accent-blue)">https://apgcl-monitor.in/dashboard</span><br><br>
              APGCL — Assam Power Generation Corporation Limited
            </div>
          </div>
        </div>
      </div>

      <!-- SMS Preview -->
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--space-3)">📱 SMS Notification</div>
        <div class="sms-preview">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:var(--space-2);text-align:center">APGCL-ALERTS</div>
          ${alerts.slice(0, 1).map(a => `
            <div class="sms-bubble">
              [APGCL ALERT] ${a.turbineId}: ${a.paramLabel} at ${a.value?.toFixed?.(2) ?? a.value}. OEM Limit: ${a.oemLimit}. 
              ${a.daysToBreach ? `Breach in ${a.daysToBreach}d. ` : ''}Immediate inspection required. 
              Login: apgcl-monitor.in
            </div>
            <div class="sms-time">${new Date().toLocaleTimeString('en-IN', { hour12: false })}</div>
          `).join('')}
        </div>
      </div>

      <!-- Notification settings -->
      <div style="margin-top:var(--space-5);padding-top:var(--space-4);border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:var(--space-3)">⚙️ Notification Channels</div>
        <div class="grid grid-2">
          ${[
            { label: 'Gmail Alerts', icon: '📧', enabled: true },
            { label: 'SMS Notifications', icon: '📱', enabled: true },
            { label: 'Dashboard Alerts', icon: '🖥', enabled: true },
            { label: 'Push Notifications', icon: '🔔', enabled: false },
          ].map(ch => `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-3);background:var(--bg-surface);border:1px solid var(--border);border-radius:var(--radius-md)">
              <span style="font-size:13px;font-weight:500">${ch.icon} ${ch.label}</span>
              <span style="font-size:12px;font-weight:700;color:${ch.enabled ? 'var(--green)' : 'var(--text-muted)'}">${ch.enabled ? '● Active' : '○ Off'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.querySelector('#close-modal').addEventListener('click', () => {
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 300);
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 300);
    }
  });
}
