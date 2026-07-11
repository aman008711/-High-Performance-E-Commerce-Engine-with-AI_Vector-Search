import React from 'react';
import { Activity, Layers, Database, Cpu } from 'lucide-react';

function App() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logoGroup}>
          <Activity size={28} color="var(--primary-light)" />
          <h1 style={styles.logoTitle}>AeroCache <span style={styles.badge}>v1.0.0</span></h1>
        </div>
        <div style={styles.headerInfo}>
          <span style={styles.telemetryTag}>
            <span style={styles.pulseDot}></span> System Live
          </span>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.heroSection}>
          <h2 style={styles.heroTitle} className="gradient-text">
            High-Performance E-Commerce Engine
          </h2>
          <p style={styles.heroSubtitle}>
            Cache-Aside logic enabled with sub-50ms Redis querying and native MongoDB AI vector search.
          </p>
        </section>

        <section style={styles.gridSection}>
          <div style={styles.card} className="pulse-glow">
            <Layers size={24} color="var(--primary-light)" style={styles.cardIcon} />
            <h3 style={styles.cardTitle}>Environment Configuration</h3>
            <p style={styles.cardText}>
              Backend REST API set up on Express + TypeScript. Frontend Client configured using Vite + React.
            </p>
            <div style={styles.statusLabel}>Initialized</div>
          </div>

          <div style={styles.card}>
            <Database size={24} color="var(--secondary-light)" style={styles.cardIcon} />
            <h3 style={styles.cardTitle}>Mock Database Seeding</h3>
            <p style={styles.cardText}>
              A data seeding engine will populate MongoDB collections with thousands of realistic product files.
            </p>
            <div style={styles.statusLabelPending}>Pending Week 1</div>
          </div>

          <div style={styles.card}>
            <Cpu size={24} color="var(--success)" style={styles.cardIcon} />
            <h3 style={styles.cardTitle}>Cache-Aside Pattern</h3>
            <p style={styles.cardText}>
              Endpoints fetch from Redis caching, falling back transparently to database layers on miss events.
            </p>
            <div style={styles.statusLabelPending}>Pending Week 2</div>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <p>&copy; 2026 AeroCache Technologies. All rights reserved.</p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '0 2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem 0',
    borderBottom: '1px solid var(--border-color)',
  },
  logoGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  logoTitle: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: 'var(--text-main)',
  },
  badge: {
    fontSize: '0.75rem',
    fontWeight: '400',
    background: 'var(--primary-glow)',
    color: 'var(--primary-light)',
    padding: '2px 8px',
    borderRadius: '10px',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    marginLeft: '0.5rem',
    verticalAlign: 'middle',
  },
  headerInfo: {
    display: 'flex',
    alignItems: 'center',
  },
  telemetryTag: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-surface)',
    padding: '0.35rem 0.75rem',
    borderRadius: '20px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  pulseDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'var(--success)',
    boxShadow: '0 0 8px var(--success)',
    display: 'inline-block',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '4rem 0',
    textAlign: 'center',
  },
  heroSection: {
    maxWidth: '800px',
    marginBottom: '3.5rem',
  },
  heroTitle: {
    fontSize: '3rem',
    marginBottom: '1rem',
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
  },
  gridSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '2rem',
    width: '100%',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: '2rem',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    transition: 'transform 0.2s ease, border-color 0.2s ease',
  },
  cardIcon: {
    marginBottom: '1.25rem',
  },
  cardTitle: {
    fontSize: '1.2rem',
    marginBottom: '0.75rem',
    color: 'var(--text-main)',
  },
  cardText: {
    fontSize: '0.95rem',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    marginBottom: '1.5rem',
    flex: 1,
  },
  statusLabel: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--primary-light)',
    backgroundColor: 'var(--primary-glow)',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(139, 92, 246, 0.2)',
  },
  statusLabelPending: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-dark)',
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    padding: '4px 10px',
    borderRadius: '4px',
    border: '1px solid rgba(100, 116, 139, 0.2)',
  },
  footer: {
    textAlign: 'center',
    padding: '2rem 0',
    borderTop: '1px solid var(--border-color)',
    color: 'var(--text-dark)',
    fontSize: '0.85rem',
  },
};

export default App;
