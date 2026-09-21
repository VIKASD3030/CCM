import * as React from 'react';
import './landing-page.css';

/**
 * Pre-login splash page. Shown before the CCM login screen; the "Login"
 * button in the top-right takes the user to the existing login flow
 * (Systra Azure AD / External OTP) unchanged. Uses a plain callback rather
 * than a router link so it doesn't interfere with the app's own hash-based
 * navigation once the user is signed in.
 */
export default function LandingPage({ onLoginClick }) {
  return (
    <div className="landing-page">
      <div className="landing-page-bg" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}img/landing-bg.png)` }} aria-hidden="true" />
      <div className="landing-page-scrim" aria-hidden="true" />

      <header className="landing-page-topbar">
        <div className="landing-page-brand">
          <img src={`${import.meta.env.BASE_URL}img/logo.png`} alt="Systra" className="landing-page-logo" />
          <span className="landing-page-brand-divider" />
          <span className="landing-page-brand-name">CCM</span>
        </div>
        <button type="button" className="landing-page-login-btn" onClick={onLoginClick}>Login</button>
      </header>

      <main className="landing-page-hero">
        <div className="landing-page-accent-bar" />
        <div className="landing-page-content">
          <p className="landing-page-eyebrow">SYSTRA DIGITAL INTELLIGENCE</p>
          <h1 className="landing-page-title">
            AI Agent for<br />Contract &amp; Claim Management
          </h1>
          <p className="landing-page-subtitle">From fragmented records to defensible decisions.</p>
          <div className="landing-page-pills">
            <span className="landing-page-pill landing-page-pill-solid">EVIDENCE-LED</span>
            <span className="landing-page-pill landing-page-pill-outline">HUMAN-GOVERNED</span>
          </div>
        </div>
      </main>
    </div>
  );
}
