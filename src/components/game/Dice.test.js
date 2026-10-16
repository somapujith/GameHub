import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dice } from './Dice.jsx';

const render = (dice, rolling = false) => renderToString(createElement(Dice, {
  session: { display: { dice }, rolling, options: { roll: true } },
}));

describe('single die presentation', () => {
  it('has one cube and leaves rolling to the central roll button', () => {
    const html = render([4]);
    expect(html.match(/class="hb-cube"/g)).toHaveLength(1);
    expect(html).not.toContain('<button');
    expect(html).toContain('Die shows 4. Move 4 spaces.');
  });

  it('announces ready before the first result and rolling without a stale result', () => {
    const ready = render([0]);
    expect(ready).toContain('Ready to roll');
    expect(ready).not.toContain('Die shows');
    const rolling = render([4], true);
    expect(rolling).toContain('Rolling the die');
    expect(rolling).not.toContain('Move 4');
  });
});
