import type { MarketplaceInstalledRecord } from '@/api/types';
import { buildChatSlashItems, buildSelectedSkillItems } from '@/components/chat/adapters/chat-input-bar.adapter';

function createSkillRecord(partial: Partial<MarketplaceInstalledRecord>): MarketplaceInstalledRecord {
  return {
    type: 'skill' as never,
    spec: 'demo.skill',
    ...partial
  };
}

describe('buildChatSlashItems', () => {
  const texts = {
    slashSkillSubtitle: 'Skill',
    slashSkillSpecLabel: 'Spec',
    noSkillDescription: 'No description'
  };

  it('sorts exact spec matches ahead of weaker matches', () => {
    const items = buildChatSlashItems(
      [
        createSkillRecord({ spec: 'web-search', label: 'Web Search' }),
        createSkillRecord({ spec: 'weather', label: 'Web Weather' })
      ],
      'web',
      texts
    );

    expect(items.map((item) => item.value)).toEqual(['web-search', 'weather']);
    expect(items[0]?.detailLines).toContain('Spec: web-search');
  });

  it('returns an empty list when nothing matches', () => {
    const items = buildChatSlashItems([createSkillRecord({ spec: 'weather' })], 'terminal', texts);
    expect(items).toEqual([]);
  });
});

describe('buildSelectedSkillItems', () => {
  it('keeps selected specs and resolves labels when available', () => {
    const chips = buildSelectedSkillItems(
      ['web-search', 'missing-skill'],
      [createSkillRecord({ spec: 'web-search', label: 'Web Search' })]
    );

    expect(chips).toEqual([
      { key: 'web-search', label: 'Web Search' },
      { key: 'missing-skill', label: 'missing-skill' }
    ]);
  });
});
