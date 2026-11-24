import { useEffect, useState } from 'react';
import { getRDKitStatus, loadRDKit, onRDKitStatus, RDKitModule, RDKitStatus } from '../services/rdkit';

/** Carrega o RDKit e expõe o módulo quando pronto. */
export function useRDKit(autoload = true) {
  const [status, setStatus] = useState<RDKitStatus>(getRDKitStatus().status);
  const [rdkit, setRdkit] = useState<RDKitModule | null>(null);
  useEffect(() => {
    const off = onRDKitStatus(setStatus);
    if (autoload) {
      loadRDKit().then(setRdkit).catch(() => undefined);
    }
    return () => {
      off();
    };
  }, [autoload]);
  return { rdkit, status, error: getRDKitStatus().error };
}
