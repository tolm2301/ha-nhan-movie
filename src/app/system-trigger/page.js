'use client';

import { useState } from 'react';

export default function AdminTriggerPage() {
  const [secret, setSecret] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [status, setStatus] = useState('');

  const handleTrigger = async () => {
    if (!secret) {
      setStatus('Please enter the secret.');
      return;
    }
    
    setStatus('Triggering crawl... Note: Vercel may return a 504 timeout error after 10-60s, but the process might still be running in the background. Check crawl logs.');
    
    try {
      const res = await fetch(`/api/cron/crawl?secret=${encodeURIComponent(secret)}${dryRun ? '&dryRun=1' : ''}`, {
        method: 'POST'
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setStatus(`Success: ${JSON.stringify(data, null, 2)}`);
      } else {
        setStatus(`Error: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (err) {
      setStatus(`Fetch failed: ${err.message}. (If 504 Timeout, crawl might still be running)`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>System Trigger</h1>
      <p style={{ color: 'red' }}><strong>Warning:</strong> Manual trigger can hit Vercel Serverless execution timeouts.</p>
      
      <div style={{ marginTop: '1rem' }}>
        <label>
          Cron Secret:
          <input 
            type="password" 
            value={secret} 
            onChange={e => setSecret(e.target.value)}
            style={{ marginLeft: '1rem', padding: '0.25rem', color: 'black' }}
          />
        </label>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          <input 
            type="checkbox" 
            checked={dryRun} 
            onChange={e => setDryRun(e.target.checked)}
            style={{ marginRight: '0.5rem' }}
          />
          Dry Run (do not save to DB)
        </label>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <button 
          onClick={handleTrigger}
          style={{ padding: '0.5rem 1rem', background: '#e50914', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Run Crawl
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', background: '#333', color: '#fff', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
        {status || 'Waiting for action...'}
      </div>
    </div>
  );
}