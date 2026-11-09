import { useEffect, useState } from 'react';
import { INKS } from '../data/catalog';
import { useStore } from '../state/store';
import type { InkKey } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { UiIcon } from './UiIcon';

type Step = 'pick' | 'moving' | 'swap' | 'testing';

/** Guides through swapping the pen: the machine brings the pen holder forward, you swap, it draws a test dot. */
export function PenChangeModal({ open, target, onClose }: { open: boolean; target?: InkKey; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [ink, setInk] = useState<InkKey>(target ?? 'charcoal');
  const [step, setStep] = useState<Step>('pick');
  const connected = !!state.machine.device;
  const loaded = state.machine.pen;

  useEffect(() => {
    if (!open) return;
    setInk(target ?? (loaded === 'charcoal' ? 'blue' : 'charcoal'));
    setStep(target ? (connected ? 'moving' : 'swap') : 'pick');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (step === 'moving') {
      const t = window.setTimeout(() => setStep('swap'), 1300);
      return () => window.clearTimeout(t);
    }
    if (step === 'testing') {
      const t = window.setTimeout(() => {
        // A different pen is a fresh one; putting the same pen back keeps its count.
        dispatch({ type: 'MACHINE', patch: { pen: ink, used: ink === loaded ? state.machine.used : 0 } });
        toast(`${INKS[ink].pen} is ready.`, 'success');
        onClose();
      }, 1300);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change the pen"
      footer={
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {step === 'pick' && (
            <button type="button" className="btn btn-primary" onClick={() => setStep(connected ? 'moving' : 'swap')}>
              Next
            </button>
          )}
          {step === 'swap' && (
            <button type="button" className="btn btn-primary" onClick={() => setStep('testing')}>
              <UiIcon name="check" />
              The new pen is in
            </button>
          )}
        </div>
      }
    >
      {step === 'pick' && (
        <>
          <p>Which pen are you putting in?</p>
          <div className="ink-list" role="radiogroup" aria-label="New pen">
            {(Object.keys(INKS) as InkKey[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={ink === k} className={`ink-opt${ink === k ? ' is-on' : ''}`} onClick={() => setInk(k)}>
                <span className="ink-dot" style={{ background: INKS[k].color }} />
                {INKS[k].pen}
                {k === loaded && <span className="muted small"> (in now)</span>}
              </button>
            ))}
          </div>
        </>
      )}
      {step === 'moving' && (
        <div className="pen-step">
          <span className="spinner" aria-hidden="true" />
          <p>The pen holder is moving to the front, so you can reach it…</p>
        </div>
      )}
      {step === 'swap' && (
        <ol className="howto">
          <li>Pull the {INKS[loaded].label.toLowerCase()} pen up and out of the holder.</li>
          <li>
            Put in the <strong>{INKS[ink].pen}</strong>, tip down, and push until it clicks.
          </li>
          <li>Put the cap of the new pen on the old one, so it doesn’t dry out.</li>
        </ol>
      )}
      {step === 'testing' && (
        <div className="pen-step">
          <span className="spinner" aria-hidden="true" />
          <p>Drawing a small test dot in the corner…</p>
        </div>
      )}
    </Modal>
  );
}
