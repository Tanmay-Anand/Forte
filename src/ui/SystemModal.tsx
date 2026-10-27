import React, { useEffect, useState } from 'react';
import { Modal, type ModalProps } from 'react-native';
import {
  BAR_SETTLE_MS,
  releaseNavigationBarForModal,
  revealNavigationBarForModal,
} from './system-bars';

/**
 * The only way to open a modal in Forte. A drop-in for React Native's <Modal>
 * that shows the Android navigation bar first and only then creates the
 * dialog window, because a dialog opened while the bar is hidden renders
 * nothing and blocks all input (see system-bars.ts). The bar hides again when
 * the last open modal closes.
 *
 * Costs ~150 ms between the tap and the sheet appearing.
 */
export function SystemModal({ visible, children, ...rest }: ModalProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void revealNavigationBarForModal().then(() => {
      timer = setTimeout(() => {
        if (alive) setShown(true);
      }, BAR_SETTLE_MS);
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      setShown(false);
      releaseNavigationBarForModal();
    };
  }, [visible]);

  return (
    <Modal visible={shown} {...rest}>
      {children}
    </Modal>
  );
}
