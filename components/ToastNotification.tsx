import React, { useEffect, useState } from 'react';

export interface ToastMessage {
  id: number;
  type: 'trade-open' | 'tp-hit' | 'sl-hit' | 'manual-close';
  text: string;
}

interface Props {
  messages: ToastMessage[];
  onDismiss: (id: number) => void;
}

export const ToastNotification: React.FC<Props> = ({ messages, onDismiss }) => {
  useEffect(() => {
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    const timer = setTimeout(() => onDismiss(latest.id), 3000);
    return () => clearTimeout(timer);
  }, [messages, onDismiss]);

  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 pointer-events-none">
      {messages.map(msg => {
        const color =
          msg.type === 'tp-hit' ? '#089981' :
          msg.type === 'sl-hit' ? '#f23645' :
          msg.type === 'trade-open' ? '#2962ff' : '#888';
        return (
          <div
            key={msg.id}
            className="px-3 py-2 rounded text-xs font-mono text-white shadow-lg pointer-events-auto"
            style={{ background: color, minWidth: 240, opacity: 0.95 }}
          >
            {msg.text}
          </div>
        );
      })}
    </div>
  );
};
