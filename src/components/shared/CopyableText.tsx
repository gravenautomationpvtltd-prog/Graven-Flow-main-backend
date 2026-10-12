import React, { useState, ReactNode } from 'react';
import { Copy, Check, Phone, Mail, ExternalLink } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface CopyableTextProps {
  /** The text content to display and copy by default */
  text?: string | null;
  /** Custom text to copy if different from display text */
  copyValue?: string | null;
  /** Label for accessibility and tooltip, e.g. "phone", "email", "company" */
  label?: string;
  /** Custom children to render instead of plain text */
  children?: ReactNode;
  /** Extra container styling */
  className?: string;
  /** Extra text styling */
  textClassName?: string;
  /** Whether to show the copy icon on hover only (default: true) */
  showOnHoverOnly?: boolean;
  /** Position of copy button (default: 'right') */
  iconPosition?: 'left' | 'right';
  /** Optional link type: tel, mailto, external, or none */
  asLink?: 'tel' | 'mailto' | 'external';
  /** Custom href if link */
  href?: string;
  /** Truncate text with ellipsis */
  truncate?: boolean;
  /** Title attribute */
  title?: string;
  /** If empty/null text, render fallback (default: '—') */
  fallback?: string;
  /** Optional click handler to open/navigate when clicking the text */
  onClickText?: (e: React.MouseEvent) => void;
}

export async function copyToClipboard(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (err) {
    // Fall back to execCommand
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch {
    return false;
  }
}

export function CopyableText({
  text,
  copyValue,
  label,
  children,
  className,
  textClassName,
  showOnHoverOnly = true,
  iconPosition = 'right',
  asLink,
  href,
  truncate = false,
  title,
  fallback = '—',
  onClickText,
}: CopyableTextProps) {
  const [copied, setCopied] = useState(false);

  const displayString = text ?? (typeof children === 'string' ? children : '');
  const toCopy = copyValue ?? displayString ?? '';

  if (!displayString && !children) {
    return <span className={cn('text-muted-foreground select-none', className)}>{fallback}</span>;
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!toCopy) return;

    const ok = await copyToClipboard(toCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Prevent row click / accidental navigation when interacting with text container
    e.stopPropagation();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent row-level mouse events while highlighting text
    e.stopPropagation();
  };

  const handleTextClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If user was highlighting text, don't trigger click action
    const sel = typeof window !== 'undefined' ? window.getSelection()?.toString() : '';
    if (sel && sel.trim().length > 0) {
      return;
    }
    onClickText?.(e);
  };

  let linkHref = href;
  if (!linkHref && asLink) {
    if (asLink === 'tel') {
      const cleanPhone = toCopy.replace(/[^\d+]/g, '');
      linkHref = `tel:${cleanPhone}`;
    } else if (asLink === 'mailto') {
      linkHref = `mailto:${toCopy.trim()}`;
    }
  }

  const contentClasses = cn(
    'select-text',
    onClickText ? 'cursor-pointer hover:underline hover:text-primary transition-colors font-medium text-foreground' : 'cursor-text',
    truncate && 'truncate',
    textClassName
  );

  const renderedContent = children ? (
    <span
      className={contentClasses}
      onClick={onClickText ? handleTextClick : undefined}
      role={onClickText ? 'button' : undefined}
      tabIndex={onClickText ? 0 : undefined}
      onKeyDown={onClickText ? (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onClickText(e as any);
        }
      } : undefined}
      title={title}
    >
      {children}
    </span>
  ) : (
    <span
      className={contentClasses}
      onClick={onClickText ? handleTextClick : undefined}
      role={onClickText ? 'button' : undefined}
      tabIndex={onClickText ? 0 : undefined}
      onKeyDown={onClickText ? (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          onClickText(e as any);
        }
      } : undefined}
      title={title || (typeof displayString === 'string' ? displayString : undefined)}
    >
      {displayString}
    </span>
  );

  const copyButton = (
    <TooltipProvider delayDuration={150}>
      <Tooltip open={copied ? true : undefined}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={copied ? 'Copied' : `Copy ${label || 'text'}`}
            className={cn(
              'inline-flex items-center gap-1 p-0.5 rounded transition-all duration-150 shrink-0 select-none focus:outline-none',
              copied
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
                : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted/70',
              showOnHoverOnly && !copied && 'opacity-0 group-hover/copy:opacity-100 focus:opacity-100'
            )}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 stroke-[2.5] text-emerald-600 dark:text-emerald-400 animate-in zoom-in-75 duration-150" />
                <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 px-1 py-0.2 rounded leading-tight bg-emerald-100/80 dark:bg-emerald-900/50 animate-in fade-in-50 duration-150">
                  Copied
                </span>
              </>
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs py-1 px-2 select-none">
          {copied ? 'Copied to clipboard!' : `Copy ${label || 'text'}`}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <span
      className={cn(
        'group/copy inline-flex items-center gap-1.5 max-w-full select-text align-middle',
        className
      )}
      onClick={handleContainerClick}
      onMouseDown={handleMouseDown}
    >
      {iconPosition === 'left' && copyButton}

      {asLink && linkHref ? (
        <a
          href={linkHref}
          target={asLink === 'external' ? '_blank' : undefined}
          rel={asLink === 'external' ? 'noreferrer' : undefined}
          className={cn(
            'hover:underline hover:text-primary transition-colors select-text',
            truncate && 'truncate',
            textClassName
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {renderedContent}
        </a>
      ) : (
        renderedContent
      )}

      {iconPosition === 'right' && copyButton}
    </span>
  );
}

/**
 * Convenience component for phone numbers with optional dialer link
 */
export function CopyablePhone({
  phone,
  className,
  textClassName,
  label = 'phone number',
  allowCall = true,
}: {
  phone?: string | null;
  className?: string;
  textClassName?: string;
  label?: string;
  allowCall?: boolean;
}) {
  if (!phone) return <span className="text-muted-foreground select-none">—</span>;

  return (
    <CopyableText
      text={phone}
      label={label}
      asLink={allowCall ? 'tel' : undefined}
      className={className}
      textClassName={cn('font-mono text-xs', textClassName)}
      title={`Phone: ${phone}`}
    />
  );
}

/**
 * Convenience component for email addresses with optional mailto link
 */
export function CopyableEmail({
  email,
  className,
  textClassName,
  label = 'email address',
  allowMailto = true,
}: {
  email?: string | null;
  className?: string;
  textClassName?: string;
  label?: string;
  allowMailto?: boolean;
}) {
  if (!email) return <span className="text-muted-foreground select-none">—</span>;

  return (
    <CopyableText
      text={email}
      label={label}
      asLink={allowMailto ? 'mailto' : undefined}
      className={className}
      textClassName={cn('text-xs', textClassName)}
      truncate
      title={`Email: ${email}`}
    />
  );
}
