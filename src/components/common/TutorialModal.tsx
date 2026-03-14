import { useState } from 'react';
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  Search,
  Settings,
  Keyboard,
  ChevronRight,
  Lock,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Section {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: React.ReactNode;
}

const sections: Section[] = [
  {
    id: 'welcome',
    icon: Lock,
    title: 'Welcome to Reflekt',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Reflekt is a <strong>private, AI-powered journal</strong> that lives entirely on your
          device. Your entries are encrypted locally — no server ever sees your plaintext data.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Write daily journal entries and notes, organized by date</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Chat with an AI that has context about your recent entries</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Automatically generate structured notes from your conversations</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>Search your entire journal history using natural language</span>
          </li>
        </ul>
        <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
          <strong>Getting started:</strong> Go to <strong>Settings</strong> and add your OpenRouter
          API key to enable AI features. Reflekt works with GPT-4, Claude, Gemini, and hundreds of
          other models via OpenRouter.
        </div>
      </div>
    ),
  },
  {
    id: 'journal',
    icon: BookOpen,
    title: 'Daily Journal',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The <strong>Journal</strong> page is your daily workspace. Each day has its own notes and
          chat history.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Notes tab</strong> — view and edit all notes for the day in a masonry grid.
              Click a note to open the full editor.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Chat tab</strong> — talk to the AI about your day. It sees your existing notes
              as context.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Date navigation</strong> — use the arrows or click the date to pick any day
              from the calendar.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Categories</strong> — assign each note a category (e.g. Work, Health, Ideas)
              to keep things organized.
            </span>
          </li>
        </ul>
        <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
          Notes auto-save as you type. You can also add a note manually by clicking <strong>+ Add note</strong> in the Notes tab.
        </div>
      </div>
    ),
  },
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'AI Chat',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          The <strong>Chat</strong> tab on the Journal page lets you have a real conversation with
          an AI assistant that is aware of your journal.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              The AI reads your notes for the current day before each reply, so it stays in context
              with what you have written.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Use it to <strong>reflect</strong> on your day, brainstorm ideas, work through
              problems, or just think out loud.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Model selector</strong> — switch AI models at any time using the icon in the
              chat header. Supports all OpenRouter models.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Responses stream in real time. Hit the stop button to interrupt a long reply.
            </span>
          </li>
        </ul>
        <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
          You can customise what persona and instructions the AI follows in <strong>Settings → Prompt</strong>.
        </div>
      </div>
    ),
  },
  {
    id: 'notes',
    icon: Sparkles,
    title: 'AI-Generated Notes',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          After a chat session, Reflekt can automatically extract and structure the key insights
          into notes.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Generate notes</strong> — in the Notes tab, click the sparkle button to
              create notes from today's chat conversation.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              A preview modal shows all suggested notes before they are saved — edit, remove, or
              accept them.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Regenerate</strong> — already have notes? Use the regenerate button to
              refresh them based on the latest conversation.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Generated notes are full notes — you can edit their title, category, and content just
              like any hand-written note.
            </span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'search',
    icon: Search,
    title: 'Memory & Search',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Reflekt builds a <strong>local semantic index</strong> of your notes so you can search
          using natural language — no keywords required.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Press <kbd className="inline-flex h-5 items-center rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>{' '}
              (or Ctrl+K) anywhere to open the memory search.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Ask questions like <em>"times I felt anxious about work"</em> or{' '}
              <em>"ideas I had about the project"</em> — it finds semantically related notes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Recurring themes</strong> are shown automatically — patterns the AI has
              detected across your entries over time.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              Click any result to jump directly to that day's journal entry or note.
            </span>
          </li>
        </ul>
        <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
          The index is built entirely on-device using local embeddings. Your notes never leave your
          browser for search.
        </div>
      </div>
    ),
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Configure Reflekt to work exactly the way you want from the <strong>Settings</strong> page.
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>API Key</strong> — paste your OpenRouter API key to unlock all AI features.
              Get one free at openrouter.ai.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Model selection</strong> — choose and pin your preferred AI model. Filter by
              provider, search by name, or sort by price.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Custom prompt</strong> — edit the system prompt the AI uses. Click <em>Build with AI</em> for an interactive prompt builder.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Security</strong> — change your password, set up biometric unlock (Face ID /
              fingerprint), or clear all local data.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <span>
              <strong>Sync</strong> — optionally connect Google Drive to back up your encrypted
              journal across devices.
            </span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    content: (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Reflekt is built for fast keyboard navigation.
        </p>
        <div className="space-y-2">
          {[
            { keys: ['J'], description: 'Go to Journal' },
            { keys: ['E'], description: 'Go to Entries' },
            { keys: ['S'], description: 'Go to Settings' },
            { keys: ['⌘', 'K'], description: 'Open Memory Search' },
            { keys: ['←', '→'], description: 'Previous / next day (in Journal)' },
          ].map(({ keys, description }) => (
            <div key={description} className="flex items-center justify-between">
              <span className="text-sm">{description}</span>
              <div className="flex items-center gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex h-6 items-center rounded border bg-muted px-2 font-mono text-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-md bg-muted/50 border p-3 text-xs text-muted-foreground">
          Keyboard shortcuts are disabled while typing in an input or text area.
        </div>
      </div>
    ),
  },
];

interface TutorialModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TutorialModal({ open, onOpenChange }: TutorialModalProps) {
  const [activeId, setActiveId] = useState('welcome');
  const activeSection = sections.find((s) => s.id === activeId) ?? sections[0]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary" />
            How to use Reflekt
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 border-r bg-muted/30 overflow-y-auto py-2">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveId(section.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                    activeId === section.id
                      ? 'bg-background text-foreground font-medium border-r-2 border-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{section.title}</span>
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              {(() => {
                const Icon = activeSection.icon;
                return <Icon className="w-4 h-4 text-primary" />;
              })()}
              {activeSection.title}
            </h2>
            {activeSection.content}
          </div>
        </div>

        <div className="px-6 py-3 border-t shrink-0 flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn('w-8 h-8 p-0', className)}
        title="Help & tutorial"
        aria-label="Help & tutorial"
      >
        <HelpCircle className="w-4 h-4" />
      </Button>
      <TutorialModal open={open} onOpenChange={setOpen} />
    </>
  );
}
