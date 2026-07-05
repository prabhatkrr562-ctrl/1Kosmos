import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DashboardAIChat.css';
import { API_URL } from '../../config/api';

const STARTERS = {
  pipeline: [
    'Current pipeline?',
    'Top owners',
    'Pipeline by region',
    'Which deals need attention?',
    'Coverage vs target',
    'Stage concentration',
  ],
  arr: [
    'Current ARR?',
    'Top customers',
    'ARR by region',
    'GRR analysis',
    'NRR breakdown',
    'Who churned?',
    'Top sales reps',
    'Product mix',
    'ARR trend',
    'Customer risk',
  ],
  ar: [
    'Current AR?',
    'Top overdue customers',
    'AR by region',
    '91+ bucket risk',
    'Pending renewals',
    'Collection focus',
  ],
};

function cleanMessages(messages) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .slice(-8)
    .map(({ role, content }) => ({ role, content }));
}

export function DashboardAIChat({ dashboard, activeTab, filters = {} }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Hi, I'm your 1Kosmos dashboard assistant. Ask me about KPIs, customers, reps, regions, churn, risk, trends, or deal focus, and I'll answer using your current dashboard data.",
    },
  ]);

  const visibleFilters = useMemo(
    () => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
    [filters],
  );

  const ask = async (text) => {
    const prompt = text.trim();
    if (!prompt || busy) return;

    const nextMessages = [...messages, { role: 'user', content: prompt }];
    setMessages(nextMessages);
    setQuestion('');
    setBusy(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard,
          active_tab: activeTab,
          filters: visibleFilters,
          question: prompt,
          messages: cleanMessages(messages),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI assistant is unavailable.');
      setMessages([...nextMessages, { role: 'assistant', content: result.answer }]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: error.message,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`ai-chat${open ? ' open' : ''}`}>
      {open && (
        <div className="ai-chat-panel" role="dialog" aria-label="Dashboard AI assistant">
          <div className="ai-chat-head">
            <div>
              <div className="ai-chat-title">1Kosmos AI Assistant</div>
              <div className="ai-chat-subtitle">
                {activeTab ? `${dashboard.toUpperCase()} / ${activeTab}` : dashboard.toUpperCase()}
              </div>
            </div>
            <span className="ai-status" title="Dashboard assistant is active" />
            <button className="ai-icon-btn" type="button" onClick={() => setOpen(false)} aria-label="Close AI chat">
              X
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`ai-message ${message.role}`}>
                {message.role === 'assistant' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                ) : (
                  message.content
                )}
              </div>
            ))}
            {busy && <div className="ai-message assistant">Thinking with dashboard context...</div>}
          </div>

          <div className="ai-starters">
            <div className="ai-starters-label">Ask</div>
            {(STARTERS[dashboard] || STARTERS.pipeline).map((starter) => (
              <button key={starter} type="button" onClick={() => ask(starter)} disabled={busy}>
                {starter}
              </button>
            ))}
          </div>

          <form
            className="ai-chat-form"
            onSubmit={(event) => {
              event.preventDefault();
              ask(question);
            }}
          >
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Ask about this dashboard..."
              disabled={busy}
            />
            <button type="submit" disabled={busy || !question.trim()} aria-label="Send question">
              Send
            </button>
          </form>
        </div>
      )}

      <button className="ai-chat-launcher" type="button" onClick={() => setOpen((value) => !value)}>
        AI
        <span>Ask AI</span>
      </button>
    </div>
  );
}
