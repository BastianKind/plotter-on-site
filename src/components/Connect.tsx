import { useEffect, useState } from 'react';
import { FOUND_DEVICES } from '../data/catalog';
import { useStore } from '../state/store';
import type { Device } from '../types';
import { Modal } from './Modal';
import { useToast } from './Toast';
import { UiIcon } from './UiIcon';

type Stage = 'search' | 'list' | 'connecting';

const STEPS = ['Opening the connection', 'Checking the firmware (1.2.0)', 'Moving the pen to its home position'];

/** Find a plotter over USB or Wi-Fi and connect to it. All simulated in the prototype. */
export function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useStore();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('search');
  const [device, setDevice] = useState<Device | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    setStage('search');
    setDevice(null);
    setStep(0);
    const t = window.setTimeout(() => setStage('list'), 1600);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (stage !== 'connecting' || !device) return;
    if (step >= STEPS.length) {
      dispatch({ type: 'CONNECT', device });
      toast(`Connected to ${device.name}.`, 'success');
      onClose();
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), 700);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, step, device]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Connect a machine"
      footer={
        <div className="modal-actions">
          {stage === 'list' && (
            <button type="button" className="btn btn-ghost" onClick={() => setStage('search')}>
              <UiIcon name="refresh" />
              Search again
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {stage === 'list' && (
            <button type="button" className="btn btn-primary" disabled={!device} onClick={() => setStage('connecting')}>
              <UiIcon name="link" />
              Connect
            </button>
          )}
        </div>
      }
    >
      {stage === 'search' && (
        <div className="connect-search">
          <span className="spinner" aria-hidden="true" />
          <p>Looking for plotters on USB and on this Wi-Fi…</p>
          <p className="muted small">Make sure the machine is switched on. The light on the front blinks blue when it’s ready to connect.</p>
        </div>
      )}

      {stage === 'list' && (
        <div className="device-list" role="radiogroup" aria-label="Machines found">
          {FOUND_DEVICES.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={device?.id === d.id} className={`device${device?.id === d.id ? ' is-on' : ''}`} onClick={() => setDevice(d)} onDoubleClick={() => (setDevice(d), setStage('connecting'))}>
              <span className="device-icon">
                <UiIcon name={d.via === 'USB' ? 'usb' : 'wifi'} size={22} />
              </span>
              <span className="device-text">
                <strong>{d.name}</strong>
                <span className="muted small">
                  {d.via} · {d.address}
                </span>
              </span>
              <span className="device-state">Ready</span>
            </button>
          ))}
          <p className="muted small">Not listed? Plug in the USB cable, or hold the button on the back for 3 seconds to join this Wi-Fi.</p>
        </div>
      )}

      {stage === 'connecting' && device && (
        <ol className="connect-steps">
          {STEPS.map((s, i) => (
            <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
              <span className="cs-dot">{i < step ? <UiIcon name="check" size={14} /> : i === step ? <span className="spinner sm" /> : null}</span>
              {s}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
