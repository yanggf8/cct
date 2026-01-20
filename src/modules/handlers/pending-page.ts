import { getSharedNavHTML, getNavScripts } from '../../utils/html-templates.js';

interface PendingPageOptions {
  title: string;
  reportType: 'pre-market' | 'intraday' | 'end-of-day' | 'weekly';
  dateStr: string;
  scheduledHourUTC: number;
  scheduledMinuteUTC: number;
}

export function generatePendingPageHTML(options: PendingPageOptions): string {
  const { title, reportType, dateStr, scheduledHourUTC, scheduledMinuteUTC } = options;

  const targetIsoString = `${dateStr}T${String(scheduledHourUTC).padStart(2, '0')}:${String(scheduledMinuteUTC).padStart(2, '0')}:00Z`;
  const targetDateObj = new Date(targetIsoString);
  const now = Date.now();

  const nyDateString = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  const isTodayInET = nyDateString === dateStr;
  const isFuture = now < targetDateObj.getTime();

  const statusTitle = isFuture ? '⏳ Report Scheduled' : '⚠️ Report Not Available';
  
  let message = '';
  let subMessage = '';
  
  if (isFuture) {
    message = `This report is scheduled for generation.`;
    subMessage = `Expected time: <span class="sched-time" data-ts="${targetDateObj.getTime()}"></span>`;
  } else if (isTodayInET) {
    message = `The scheduled time has passed, but the data is not yet ready.`;
    subMessage = `Scheduled was: <span class="sched-time" data-ts="${targetDateObj.getTime()}"></span>. System may be processing.`;
  } else {
    message = `No data was recorded for this past date.`;
    subMessage = `Please check the system status or try a different date.`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${isFuture ? 'Scheduled' : 'Pending'}</title>
    ${getNavScripts()}
    <style>
        /* Core styles handled by reports.css */
        
        /* Pending Page Specific Overrides/Additions */
        main.container {
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 60vh;
        }
        
        .status-card {
            background: var(--card-bg);
            border: 1px solid var(--card-border);
            border-radius: var(--radius-lg);
            padding: 50px;
            text-align: center;
            max-width: 600px;
            width: 100%;
            backdrop-filter: blur(10px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2);
        }
        
        .icon-large {
            font-size: 4rem;
            margin-bottom: 20px;
            display: inline-block;
            ${isFuture || isTodayInET ? 'animation: pulse 3s infinite ease-in-out;' : ''}
        }
        
        @keyframes pulse { 0%,100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        
        .status-card h1 {
            font-size: 2rem;
            margin-bottom: 10px;
            background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .status-card h2 {
            font-size: 1.3rem;
            color: ${isFuture ? 'var(--warning)' : 'var(--error)'};
            margin-bottom: 20px;
            font-weight: 500;
        }
        
        .date-badge {
            display: inline-block;
            background: rgba(79, 172, 254, 0.1);
            color: var(--accent-primary);
            border: 1px solid rgba(79, 172, 254, 0.3);
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            margin-bottom: 25px;
        }
        
        .status-card p {
            color: var(--text-secondary);
            margin-bottom: 10px;
            line-height: 1.6;
            font-size: 1.05rem;
        }
        
        .sub-message {
            color: var(--text-muted);
            font-size: 0.9rem;
            margin-bottom: 30px;
        }
        
        .refresh-btn {
            background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary));
            color: white;
            border: none;
            padding: 12px 30px;
            border-radius: 25px;
            font-size: 1rem;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
        }
        
        .refresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79, 172, 254, 0.3);
        }
        
        .meta-info {
            margin-top: 25px;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    ${getSharedNavHTML(reportType)}
    <main class="container" role="main">
        <div class="status-card" role="alert" aria-live="polite">
            <div class="icon-large" aria-hidden="true">${isFuture ? '⏳' : '⚠️'}</div>
            <h1>${title}</h1>
            <h2>${statusTitle}</h2>
            <div class="date-badge">📅 ${dateStr}</div>
            <p>${message}</p>
            <p class="sub-message">${subMessage}</p>
            
            <a href="" class="refresh-btn" onclick="location.reload();return false;">🔄 Check Status</a>
            
            ${isFuture || isTodayInET ? `<div class="meta-info">Auto-refreshing in <span id="timer">60</span>s...</div>` : ''}
        </div>
    </main>
    <script>
        document.querySelectorAll('.sched-time').forEach(el => {
            const ts = parseInt(el.dataset.ts);
            const d = new Date(ts);
            const et = d.toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true});
            const local = d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
            el.textContent = et + ' ET (' + local + ' local)';
        });
        ${isFuture || isTodayInET ? `
        let t = 60;
        setInterval(() => { if(--t <= 0) location.reload(); document.getElementById('timer').textContent = t; }, 1000);
        ` : ''}
    </script>
</body>
</html>`;
}
