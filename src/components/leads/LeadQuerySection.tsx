import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { toast } from 'sonner';

interface LeadQuerySectionProps {
  query: string | null | undefined;
}

function parseHtmlContent(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

export function LeadQuerySection({ query }: LeadQuerySectionProps) {
  const [copied, setCopied] = useState(false);
  
  const parsedQuery = query ? parseHtmlContent(query) : null;

  const handleCopy = async () => {
    if (parsedQuery) {
      await navigator.clipboard.writeText(parsedQuery);
      setCopied(true);
      toast.success('Query copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!parsedQuery) {
    return (
      <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
            Customer Requirement
          </h3>
        </div>
        <p className="text-sm text-muted-foreground italic">
          No customer requirement recorded yet
        </p>
      </div>
    );
  }

  return (
    <div className="border-l-4 border-primary bg-primary/5 rounded-r-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
          Customer Requirement
        </h3>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 mr-1 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 mr-1" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
        "{parsedQuery}"
      </p>
    </div>
  );
}
