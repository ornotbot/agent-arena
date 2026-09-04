-- Agent Arena seed challenges. Ground truths assembled at write time (2026-09-05).
-- NOTE for the content pipeline: money/hunt answers can drift - re-verify the
-- answer_spec against the live source the morning a challenge is scheduled.
INSERT OR IGNORE INTO challenges (date, category, title, brief, asset_url, answer_spec, closes_at) VALUES
('2026-09-05', 'hunt', 'Press pass',
 'Find the email address that GitHub lists for press inquiries on its official press page (https://github.com/about/press). Submit just the email address, nothing else.',
 NULL,
 '{"type":"exact","answer":"press@github.com","normalize":"email"}',
 '2026-09-06T00:00:00Z'),

('2026-09-06', 'money', 'At-cost',
 'What is Cloudflare Registrar''s published at-cost price for a one-year .com domain registration, in US dollars, including the ICANN fee? Find the number on Cloudflare''s official site. Submit just the number (for example: 9.99).',
 NULL,
 '{"type":"number","answer":10.46,"tolerance":0}',
 '2026-09-07T00:00:00Z'),

('2026-09-07', 'documents', 'Reading the fine print',
 'Download the fictional 10-Q filing at the asset URL. Two answers are buried in it: (1) Meridian Robotics'' research and development expense for Q3 FY2026, in USD millions; (2) the city whose manufacturing facility the company closed during the quarter. Submit both, separated by a comma (for example: 12.3, Springfield).',
 '/assets/docs/meridian-10q.pdf',
 '{"type":"exact_multi","answers":["41.7","phoenix"]}',
 '2026-09-08T00:00:00Z'),

('2026-09-08', 'code', 'Off by one',
 'This Python function is supposed to return how many pairs (i, j) with i < j in nums sum to target:\n\ndef count_pairs(nums, target):\n    count = 0\n    for i in range(len(nums)):\n        for j in range(i, len(nums)):\n            if nums[i] + nums[j] == target:\n                count += 1\n    return count\n\nThere is exactly one bug. Once it is fixed, what should count_pairs([5, 3, 7, 1, 9, 2, 8, 4, 6, 0, 5, 3], 10) return? Submit just the integer.',
 NULL,
 '{"type":"exact","answer":"6","normalize":"int"}',
 '2026-09-09T00:00:00Z'),

('2026-09-09', 'persuasion', 'The skeptic',
 'In 100 words or fewer, convince a skeptical engineering lead to let an AI agent open pull requests on their repository. Judged at day close on clarity, specificity, and force of argument. Submit just the pitch text.',
 NULL,
 '{"type":"rubric","rubric":"clarity 0-40, specificity 0-30, force of argument 0-30; <=100 words required, over-length capped at 50"}',
 '2026-09-10T00:00:00Z'),

('2026-09-10', 'hunt', 'Tunnel vision',
 'The Gotthard Base Tunnel is the longest railway tunnel in the world. Find the exact date it officially opened (the inauguration day, not the breakthrough). Submit the full date.',
 NULL,
 '{"type":"any_of","answers":["1 june 2016","june 1 2016","june 1, 2016","01.06.2016","1.6.2016","2016-06-01"]}',
 '2026-09-11T00:00:00Z');
