-- Sample seed data for local development

INSERT OR IGNORE INTO posts (id, slug, title, description, content, rendered_html, tags, status, featured, created_at, updated_at, published_at)
VALUES
(
  '550e8400-e29b-41d4-a716-446655440001',
  'on-writing-well',
  'On Writing Well',
  'Reflections on the craft of writing clearly and with purpose.',
  '# On Writing Well

Writing is thinking made visible. When you sit down to write, you are not merely recording thoughts — you are *discovering* them. The blank page is both terrifying and liberating.

## The Discipline of Clarity

Good writing is the result of good thinking. Every unnecessary word you cut strengthens the sentence. Every vague phrase you sharpen brings the reader closer to your meaning.

> "The secret of good writing is to strip every sentence to its cleanest components." — William Zinsser

Consider this: most first drafts contain twice as many words as they need. The work of revision is the work of subtraction.

## Finding Your Voice

Your voice is not something you invent. It is something you uncover by writing honestly and consistently. Write as you would speak to an intelligent friend — with warmth, precision, and respect for their time.

### A Few Principles

1. **Be specific.** "The dog" is weaker than "the grey terrier."
2. **Use active voice.** "She wrote the letter" beats "The letter was written by her."
3. **Read your work aloud.** Your ear catches what your eye misses.

## The Long Game

Writing well is not a talent you are born with. It is a skill you develop over years of practice, reading, and revision. Be patient with yourself, but never stop pushing.

```
"I write to discover what I think."
— Joan Didion
```

The best time to start writing is now. The second best time is also now.',
  '<h1>On Writing Well</h1>
<p>Writing is thinking made visible. When you sit down to write, you are not merely recording thoughts — you are <em>discovering</em> them. The blank page is both terrifying and liberating.</p>
<h2>The Discipline of Clarity</h2>
<p>Good writing is the result of good thinking. Every unnecessary word you cut strengthens the sentence. Every vague phrase you sharpen brings the reader closer to your meaning.</p>
<blockquote><p>"The secret of good writing is to strip every sentence to its cleanest components." — William Zinsser</p></blockquote>
<p>Consider this: most first drafts contain twice as many words as they need. The work of revision is the work of subtraction.</p>
<h2>Finding Your Voice</h2>
<p>Your voice is not something you invent. It is something you uncover by writing honestly and consistently. Write as you would speak to an intelligent friend — with warmth, precision, and respect for their time.</p>
<h3>A Few Principles</h3>
<ol><li><strong>Be specific.</strong> "The dog" is weaker than "the grey terrier."</li><li><strong>Use active voice.</strong> "She wrote the letter" beats "The letter was written by her."</li><li><strong>Read your work aloud.</strong> Your ear catches what your eye misses.</li></ol>
<h2>The Long Game</h2>
<p>Writing well is not a talent you are born with. It is a skill you develop over years of practice, reading, and revision. Be patient with yourself, but never stop pushing.</p>
<pre><code>"I write to discover what I think."
— Joan Didion</code></pre>
<p>The best time to start writing is now. The second best time is also now.</p>',
  '["writing", "craft", "essays"]',
  'published',
  1,
  '2025-01-15T10:00:00Z',
  '2025-01-15T10:00:00Z',
  '2025-01-15T10:00:00Z'
),
(
  '550e8400-e29b-41d4-a716-446655440002',
  'the-art-of-slow-thinking',
  'The Art of Slow Thinking',
  'Why slowing down leads to better decisions and deeper understanding.',
  '# The Art of Slow Thinking

In a world optimized for speed, slowness is a radical act. We check notifications between sentences. We skim articles instead of reading them. We confuse busyness with productivity.

But the best ideas — the ones that change how we see the world — are born in stillness.

## Speed vs. Depth

Daniel Kahneman distinguished between **System 1** (fast, intuitive) and **System 2** (slow, deliberate) thinking. Most of our daily decisions use System 1. That is fine for choosing what to eat for lunch.

But for the decisions that matter — what to build, who to trust, how to live — System 2 is essential.

> "Thinking is the hardest work there is, which is probably the reason so few engage in it." — Henry Ford

## Practices for Slower Thinking

- **Morning pages**: Write three pages of stream-of-consciousness every morning.
- **Walking without headphones**: Let boredom do its work.
- **Reading long-form**: Books, not tweets. Essays, not headlines.
- **Sitting with uncertainty**: Resist the urge to decide before you understand.

## The Paradox

Slowing down does not make you less productive. It makes you *more* productive, because you spend less time fixing the mistakes that haste creates.

The tortoise was right all along.',
  '<h1>The Art of Slow Thinking</h1>
<p>In a world optimized for speed, slowness is a radical act. We check notifications between sentences. We skim articles instead of reading them. We confuse busyness with productivity.</p>
<p>But the best ideas — the ones that change how we see the world — are born in stillness.</p>
<h2>Speed vs. Depth</h2>
<p>Daniel Kahneman distinguished between <strong>System 1</strong> (fast, intuitive) and <strong>System 2</strong> (slow, deliberate) thinking. Most of our daily decisions use System 1. That is fine for choosing what to eat for lunch.</p>
<p>But for the decisions that matter — what to build, who to trust, how to live — System 2 is essential.</p>
<blockquote><p>"Thinking is the hardest work there is, which is probably the reason so few engage in it." — Henry Ford</p></blockquote>
<h2>Practices for Slower Thinking</h2>
<ul><li><strong>Morning pages</strong>: Write three pages of stream-of-consciousness every morning.</li><li><strong>Walking without headphones</strong>: Let boredom do its work.</li><li><strong>Reading long-form</strong>: Books, not tweets. Essays, not headlines.</li><li><strong>Sitting with uncertainty</strong>: Resist the urge to decide before you understand.</li></ul>
<h2>The Paradox</h2>
<p>Slowing down does not make you less productive. It makes you <em>more</em> productive, because you spend less time fixing the mistakes that haste creates.</p>
<p>The tortoise was right all along.</p>',
  '["thinking", "productivity", "essays"]',
  'published',
  1,
  '2025-02-10T10:00:00Z',
  '2025-02-10T10:00:00Z',
  '2025-02-10T10:00:00Z'
),
(
  '550e8400-e29b-41d4-a716-446655440003',
  'draft-in-progress',
  'A Draft in Progress',
  'This is a draft post that should not be visible publicly.',
  '# A Draft in Progress

This post is still being written. It should not appear on the public site.

## Notes to self

- Expand the section on creative process
- Add quotes from interviews
- Find a better opening paragraph',
  '<h1>A Draft in Progress</h1>
<p>This post is still being written. It should not appear on the public site.</p>
<h2>Notes to self</h2>
<ul><li>Expand the section on creative process</li><li>Add quotes from interviews</li><li>Find a better opening paragraph</li></ul>',
  '["draft"]',
  'draft',
  0,
  '2025-03-01T10:00:00Z',
  '2025-03-01T10:00:00Z',
  NULL
);
