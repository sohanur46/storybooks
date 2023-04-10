import { expect } from '@storybook/jest';
import { global as globalThis } from '@storybook/global';
import { userEvent, within } from '@storybook/testing-library';
import type { Meta, StoryObj } from '@storybook/vue3';
import { h } from 'vue';
import { RESET_STORY_ARGS, STORY_ARGS_UPDATED, UPDATE_STORY_ARGS } from '@storybook/core-events';
import Reactivity from './Reactivity.vue';

const meta = {
  component: Reactivity,
  args: { label: 'If you see this, args are not updated properly' },
  play: async ({ canvasElement, id, args }) => {
    const channel = globalThis.__STORYBOOK_ADDONS_CHANNEL__;

    const canvas = within(canvasElement);

    channel.emit(RESET_STORY_ARGS, { storyId: id });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));

    const input = await canvas.findByLabelText<HTMLInputElement>('Some input:');
    await userEvent.type(input, 'value');

    channel.emit(UPDATE_STORY_ARGS, {
      storyId: id,
      updatedArgs: { label: 'updated label' },
    });
    await new Promise((resolve) => channel.once(STORY_ARGS_UPDATED, resolve));

    await expect(input).toHaveValue('value'); // if this passes story is not remounted
    await expect(canvas.findByText('updated label')).resolves.toBeInTheDocument(); // if this passes story args are reactive
  },
} satisfies Meta<typeof Reactivity>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoDecorators: Story = { args: { label: 'No decorators' } };

export const DecoratorVNode: Story = {
  decorators: [
    (storyFn, context) => {
      return h('div', [h('h2', ['Decorator not using args']), [h(storyFn(context.args))]]);
    },
  ],
};

export const DecoratorVNodeArgsFromContext: Story = {
  decorators: [
    (storyFn, context) => {
      return h('div', [
        h('h2', `Decorator use args: ${context.args.label}`),
        [h(storyFn(context.args))],
      ]);
    },
  ],
};

export const DecoratorVNodeTemplate: Story = {
  decorators: [
    (storyFn, context) => {
      return h({
        components: {
          story: storyFn(context.args),
        },
        template: '<div><h2>Decorator not using args</h2><story/></div>',
      });
    },
  ],
};

export const DecoratorVNodeTemplateArgsFromData: Story = {
  decorators: [
    (storyFn, context) => {
      return h({
        components: {
          story: storyFn(context.args),
        },
        data() {
          return { args: context.args };
        },
        template: '<div><h2>Decorator using label: {{args.label}}</h2><story/></div>',
      });
    },
  ],
};

export const DecoratorVNodeTemplateArgsFromProps: Story = {
  decorators: [
    (storyFn, context) => {
      return h({
        components: {
          story: storyFn(context.args),
        },
        props: ['label'],
        template: '<div><div>Decorator using label: {{label}}</div><story/></div>',
      });
    },
  ],
};

export const DecoratorFunctionalComponent: Story = {
  decorators: [
    (storyFn, context) => {
      return () => h('div', [h('h2', ['Decorator not using args']), [h(storyFn())]]);
    },
  ],
};

export const DecoratorFunctionalComponentArgsFromContext: Story = {
  decorators: [
    (storyFn, context) => {
      return () =>
        h('div', [h('h2', ['Decorator using args.label: ', context.args.label]), [h(storyFn())]]);
    },
  ],
};

export const DecoratorFunctionalComponentArgsFromProps: Story = {
  decorators: [
    (storyFn, context) => {
      return (args) => {
        return h('div', [h('h2', `Decorator using args.label: ${args.label}`), h(storyFn())]);
      };
    },
  ],
};

export const DecoratorComponentOptions: Story = {
  decorators: [
    (storyFn, context) => {
      return {
        template: '<div><h2>Decorator not using args</h2><story/></div>',
      };
    },
  ],
};

export const DecoratorComponentOptionsArgsFromData: Story = {
  decorators: [
    (storyFn, context) => {
      return {
        data: () => ({
          args: context.args,
        }),
        template: '<div><h2>Decorator using args.label: {{args.label}}</h2><story/></div>',
      };
    },
  ],
};

export const DecoratorComponentOptionsArgsFromProps: Story = {
  decorators: [
    (storyFn, context) => {
      return {
        props: ['label'],
        template:
          '<div><h2>Decorator using args.label: {{label}}</h2><story v-bind="$props"/></div>',
      };
    },
  ],
};
