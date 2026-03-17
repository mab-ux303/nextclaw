import { fireEvent, render, screen } from '@testing-library/react';
import { ChatSlashMenu } from '@/components/chat/ui/chat-input-bar/chat-slash-menu';
import type { ChatSlashMenuProps } from '@/components/chat/view-models/chat-ui.types';

function createSlashMenuProps(overrides?: Partial<ChatSlashMenuProps>): ChatSlashMenuProps {
  return {
    anchorRef: { current: null },
    listRef: { current: null },
    isOpen: true,
    isLoading: false,
    items: [],
    activeIndex: 0,
    activeItem: null,
    texts: {
      slashLoadingLabel: 'Loading skills',
      slashSectionLabel: 'Skills',
      slashEmptyLabel: 'No matches',
      slashHintLabel: 'Type slash',
      slashSkillHintLabel: 'Press Enter to add'
    },
    onSelectItem: vi.fn(),
    onOpenChange: vi.fn(),
    onSetActiveIndex: vi.fn(),
    ...overrides
  };
}

describe('ChatSlashMenu', () => {
  it('renders loading and empty states', () => {
    const { rerender } = render(<ChatSlashMenu {...createSlashMenuProps({ isLoading: true })} />);
    expect(screen.getByText('Loading skills')).toBeTruthy();

    rerender(<ChatSlashMenu {...createSlashMenuProps()} />);
    expect(screen.getByText('No matches')).toBeTruthy();
  });

  it('renders active item details and forwards selection', () => {
    const onSelectItem = vi.fn();
    const item = {
      key: 'skill:web-search',
      title: 'Web Search',
      subtitle: 'Skill',
      description: 'Search the web',
      detailLines: ['Spec: web-search']
    };

    render(
      <ChatSlashMenu
        {...createSlashMenuProps({
          items: [item],
          activeItem: item,
          onSelectItem
        })}
      />
    );

    expect(screen.getByText('Search the web')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Web Search/i }));
    expect(onSelectItem).toHaveBeenCalledWith(item);
  });
});
