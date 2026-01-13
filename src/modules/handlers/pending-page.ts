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
  const icon = isFuture ? '⏳' : '⚠️';

  let message = '';
  if (isFuture) {
    message = `This report is automatically generated at <span class="sched-time" data-ts="${targetDateObj.getTime()}"></span>.`;
  } else if (isTodayInET) {
    message = `The scheduled time (<span class="sched-time" data-ts="${targetDateObj.getTime()}"></span>) has passed, but the data is not yet ready.`;
  } else {
    message = `No data was recorded for this past date.`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - ${isFuture ? 'Scheduled' : 'Pending'}</title>
    ${getNavScripts()}
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0d1117;
            color: #c9d1d9;
            min-height: 100vh;
            margin: 0;
            padding-top: 60px;
            display: flex;
            flex-direction: column;
        }
        main.container {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .status-card {
            max-width: 550px;
            width: 100%;
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            padding: 40px;
            text-align: center;
        }
        .icon-large {
            font-size: 4rem;
            margin-bottom: 24px;
            ${isFuture || isTodayInET ? 'animation: pulse 3s infinite ease-in-out;' : ''}
        }
        @keyframes pulse { 0%,100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
        h1 { font-size: 1.8rem; margin: 0 0 8px 0; }
        h2 { font-size: 1.2rem; color: ${isFuture ? '#feca57' : '#ff6b6b'}; margin: 0 0 24px 0; }
        p { color: #8b949e; margin-bottom: 32px; line-height: 1.6; }
        .date-badge {
            display: inline-block;
            background: rgba(56, 139, 253, 0.1);
            color: #58a6ff;
            border: 1px solid rgba(56, 139, 253, 0.4);
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
            margin-bottom: 20px;
        }
        .refresh-btn {
            background: #238636;
            color: #fff;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            font-size: 0.95rem;
            cursor: pointer;
            text-decoration: none;
        }
        .refresh-btn:hover { background: #2ea043; }
        .meta-info { margin-top: 24px; font-size: 0.85rem; color: #8b949e; }
    </style>
</head>
<body>
    ${getSharedNavHTML(reportType)}
    <main class="container" role="main">
        <div class="status-card" role="alert" aria-live="polite">
            <div class="icon-large" aria-hidden="true">${icon}</div>
            <h1>${title}</h1>
            <h2>${statusTitle}</h2>
            <div class="date-badge">📅 ${dateStr}</div>
            <p>${message}</p>
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
