// Public-facing lead capture form. Posts to the n8n webhook configured
// by the "Website Lead → Sheet" template. Designed so a non-technical
// person (or a live demo audience) can submit a lead without touching
// curl/JSON. Hosted at /forms/lead — bypassed by the admin gate via
// the matcher (we add it below) so anyone can submit.

'use client';

import { useState } from 'react';
import Image from 'next/image';

const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'phone',    label: 'Phone' },
  { value: 'instagram',label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google-ads', label: 'Google Ads' },
  { value: 'website',  label: 'Website (this form)' },
];

type Status = 'idle' | 'submitting' | 'ok' | 'error';

export default function LeadFormPage() {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [source, setSource]   = useState('website');
  const [notes, setNotes]     = useState('');
  const [status, setStatus]   = useState<Status>('idle');
  const [errMsg, setErrMsg]   = useState('');

  const priority =
    ['referral','whatsapp','phone'].includes(source) ? 'HOT'
    : ['instagram','facebook','google-ads'].includes(source) ? 'WARM'
    : 'COLD';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setErrMsg('');
    try {
      const res = await fetch('/n8n/webhook/lead-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, source, notes }),
      });
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof Error ? err.message : String(err));
    }
  }

  function reset() {
    setName(''); setEmail(''); setPhone(''); setNotes('');
    setSource('website'); setStatus('idle'); setErrMsg('');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-ink px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-brand-line bg-brand-surface p-8 shadow-lg">
        <div className="flex items-center gap-2 text-sm text-brand-subtle mb-1">
          <span className="text-brand-accent">●</span> Powered by LeanLoop
        </div>
        <h1 className="text-2xl font-semibold text-white mb-1">Get in touch</h1>
        <p className="text-sm text-brand-subtle mb-6">
          Drop your details and someone will get back to you.
        </p>

        {status === 'ok' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-brand-accent bg-brand-accent/10 p-4">
              <div className="text-brand-accent font-medium">
                ✓ Captured — talk to you soon, {name || 'friend'}.
              </div>
              <div className="mt-2 text-xs text-brand-subtle">
                Logged with priority <b className="text-white">{priority}</b> based on source.
                Behind the scenes: webhook → score &amp; tag → Google Sheet row.
              </div>
            </div>
            <button
              onClick={reset}
              className="self-start rounded-md border border-brand-line px-4 py-2 text-sm text-brand-text hover:bg-brand-muted transition"
            >
              Submit another
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Name" required>
              <input value={name} onChange={(e) => setName(e.target.value)} required
                className="form-input" placeholder="Your name" />
            </Field>
            <Field label="Email">
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
                className="form-input" placeholder="you@example.com" />
            </Field>
            <Field label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel"
                className="form-input" placeholder="+91 98765 43210" />
            </Field>
            <Field label="How did you hear about us?">
              <select value={source} onChange={(e) => setSource(e.target.value)}
                className="form-input">
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="text-[11px] text-brand-subtle mt-1">
                Will be auto-tagged as <b className="text-white">{priority}</b>.
              </span>
            </Field>
            <Field label="Notes">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="form-input" placeholder="Any specific question?" />
            </Field>

            {status === 'error' && (
              <div className="text-sm text-brand-danger">
                Something went wrong: {errMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={status === 'submitting' || !name}
              className="rounded-md bg-brand-accent px-4 py-2.5 text-sm font-medium text-black hover:bg-brand-accentHi transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'submitting' ? 'Sending…' : 'Submit'}
            </button>
          </form>
        )}
      </div>
      <style jsx>{`
        .form-input {
          background: rgb(15 23 42);
          border: 1px solid rgb(51 65 85);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          width: 100%;
        }
        .form-input:focus {
          outline: none;
          border-color: rgb(16 185 129);
        }
      `}</style>
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-brand-subtle">
      <span>
        {label}{required && <span className="text-brand-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}
