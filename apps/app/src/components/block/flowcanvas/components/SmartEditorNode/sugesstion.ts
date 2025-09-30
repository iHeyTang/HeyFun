import { ReactRenderer } from '@tiptap/react';

import MentionList, { MentionItem } from './MentionList';
import { MentionOptions } from '@tiptap/extension-mention';
import { MentionListProps, MentionListRef } from './MentionList';

export const suggestion: MentionOptions<MentionItem>['suggestion'] = {
  render: () => {
    let component: ReactRenderer<MentionListRef, MentionListProps>;

    return {
      onStart: props => {
        component = new ReactRenderer(MentionList, {
          props: {
            ...props,
          },
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        document.body.appendChild(component.element);
      },

      onUpdate(props) {
        component.updateProps({
          ...props,
        });

        if (!props.clientRect) {
          return;
        }
      },

      onKeyDown(props) {
        if (props.event.key === 'Escape') {
          component.destroy();

          return true;
        }

        return component.ref?.onKeyDown(props) || false;
      },

      onExit() {
        component.element.remove();
        component.destroy();
      },
    };
  },
};
