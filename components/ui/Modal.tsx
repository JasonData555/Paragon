'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={`bg-paragon-surface-card rounded-card shadow-xl border border-paragon-border w-full mx-4 ${maxWidth}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-paragon-border">
          <h2 className="text-sm font-medium text-paragon-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="text-paragon-text-muted hover:text-paragon-text-primary transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
