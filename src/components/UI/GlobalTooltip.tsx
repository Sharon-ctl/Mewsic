import React, { useState, useEffect } from 'react';

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number; alignX: 'left' | 'right'; alignY: 'top' | 'bottom' } | null>(null);

  useEffect(() => {
    // 1. Setup a MutationObserver to globally intercept and convert ALL `title` attributes to `data-tooltip`
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check any newly added nodes
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              // Check the element itself
              if (el.hasAttribute && el.hasAttribute('title')) {
                const text = el.getAttribute('title');
                if (text) {
                  el.setAttribute('data-tooltip', text);
                  el.removeAttribute('title');
                }
              }
              // Check all descendants
              if (el.querySelectorAll) {
                el.querySelectorAll('[title]').forEach((child) => {
                  const text = child.getAttribute('title');
                  if (text) {
                    child.setAttribute('data-tooltip', text);
                    child.removeAttribute('title');
                  }
                });
              }
            }
          });
        } else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
          // If a `title` was dynamically updated on an existing element (e.g. React state change)
          const el = mutation.target as HTMLElement;
          const text = el.getAttribute('title');
          if (text) {
            el.setAttribute('data-tooltip', text);
            el.removeAttribute('title');
          }
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['title']
    });

    // Run once on mount to catch existing ones immediately
    document.querySelectorAll('[title]').forEach((el) => {
      const text = el.getAttribute('title');
      if (text) {
        el.setAttribute('data-tooltip', text);
        el.removeAttribute('title');
      }
    });

    // 2. Handle Mouse Tracking
    let timeout: ReturnType<typeof setTimeout>;
    let currentText: string | null = null;
    let isVisible = false;

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !target.closest) return;
      
      const el = target.closest('[data-tooltip]') as HTMLElement;

      if (el) {
        const text = el.getAttribute('data-tooltip');

        if (text) {
          const alignX = e.clientX > window.innerWidth - 200 ? 'left' : 'right';
          const alignY = e.clientY > window.innerHeight - 80 ? 'top' : 'bottom';

          // If the text dynamically changed while we are actively hovering (e.g. clicked Repeat button)
          if (currentText !== text && isVisible) {
            currentText = text;
            setTooltip({ text: currentText, x: e.clientX, y: e.clientY, alignX, alignY });
          } else {
            currentText = text;
          }
          
          if (!isVisible) {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              isVisible = true;
              if (currentText) {
                setTooltip({ text: currentText, x: e.clientX, y: e.clientY, alignX, alignY });
              }
            }, 300);
          }
        }
      } else {
        clearTimeout(timeout);
        isVisible = false;
        currentText = null;
        setTooltip(null);
      }
    };

    const handleMouseLeave = () => {
      clearTimeout(timeout);
      isVisible = false;
      currentText = null;
      setTooltip(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseLeave);
    window.addEventListener('scroll', handleMouseLeave, true);

    return () => {
      observer.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseLeave);
      window.removeEventListener('scroll', handleMouseLeave, true);
      clearTimeout(timeout);
    };
  }, []);

  if (!tooltip) return null;

  return (
    <div
      key={tooltip.text} // Retrigger animation if text changes
      className="fixed z-[10000] pointer-events-none px-3 py-1.5 bg-surface-overlay border border-border-subtle rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.4)] text-[10px] font-black uppercase tracking-widest text-text-primary whitespace-nowrap"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: `translate(${tooltip.alignX === 'right' ? '14px' : 'calc(-100% - 14px)'}, ${tooltip.alignY === 'bottom' ? '14px' : 'calc(-100% - 14px)'})`,
      }}
    >
      {tooltip.text}
    </div>
  );
}
