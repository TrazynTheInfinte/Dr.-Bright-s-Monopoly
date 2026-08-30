import type { ReactNode } from 'react';
import './InfoModalShell.css';

interface InfoModalShellProps {
  eyebrow: string;
  title: string;
  closing: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Shared chrome for a dismissable reference overlay - the Rule Book and
 * the Anomaly Guide both use this (click the backdrop, the X, or just
 * read and move on - nothing here is a decision the game is waiting
 * on, unlike ActionModal). Click-outside-to-close works via a plain
 * bubbling click on the backdrop, stopped from reaching it by the
 * panel itself, rather than checking event.target - simpler, and correct
 * either way since nothing inside the panel needs its own click handling
 * that would conflict.
 */
function InfoModalShell({ eyebrow, title, closing, onClose, children }: InfoModalShellProps) {
  return (
    <div className="info-modal-overlay" onClick={onClose}>
      <div className="info-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="info-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <p className="info-modal-eyebrow">{eyebrow}</p>
        <h1 className="info-modal-title">{title}</h1>

        {children}

        <p className="info-modal-closing">{closing}</p>
      </div>
    </div>
  );
}

export default InfoModalShell;
